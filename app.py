from flask import Flask, request, jsonify, render_template
import json, csv, io, os, time, requests
from collections import Counter, defaultdict

app = Flask(__name__)

def to_num(v):
    if v is None:
        return None
    s = str(v).replace('$', '').replace(',', '').strip()
    if '%' in s:
        s = s.replace('%', '')
    if not s:
        return None
    try:
        if '.' in s:
            return float(s)
        return int(s)
    except:
        return None

def find_header(headers, keywords):
    h_lower = [h.lower() for h in headers]
    for kw in keywords:
        for i, h in enumerate(h_lower):
            if kw in h:
                return i, headers[i]
    return None, None

def compute_campaign_metrics(headers, rows):
    cost_idx, cost_col = find_header(headers, ['cost', 'spend', 'amount'])
    conv_idx, conv_col = find_header(headers, ['conversion', 'conv', 'purchases', 'sales'])
    rate_idx, rate_col = find_header(headers, ['rate', 'ctr', 'cvr', 'roas'])
    camp_idx, camp_col = find_header(headers, ['campaign', 'ad group', 'adgroup', 'campaign name'])
    click_idx, click_col = find_header(headers, ['click', 'clicks'])

    total_spend = 0
    total_conversions = 0
    total_clicks = 0
    campaign_stats = defaultdict(lambda: {'spend': 0, 'conversions': 0, 'clicks': 0, 'rate': None})

    for r in rows:
        if cost_idx is not None and len(r) > cost_idx:
            v = to_num(r[cost_idx])
            if v is not None: total_spend += v
        if conv_idx is not None and len(r) > conv_idx:
            v = to_num(r[conv_idx])
            if v is not None: total_conversions += v
        if click_idx is not None and len(r) > click_idx:
            v = to_num(r[click_idx])
            if v is not None: total_clicks += v
        if camp_idx is not None and len(r) > camp_idx:
            camp = r[camp_idx].strip()
            if cost_idx is not None and len(r) > cost_idx:
                v = to_num(r[cost_idx])
                if v is not None: campaign_stats[camp]['spend'] += v
            if conv_idx is not None and len(r) > conv_idx:
                v = to_num(r[conv_idx])
                if v is not None: campaign_stats[camp]['conversions'] += v
            if click_idx is not None and len(r) > click_idx:
                v = to_num(r[click_idx])
                if v is not None: campaign_stats[camp]['clicks'] += v
            if rate_idx is not None and len(r) > rate_idx:
                v = to_num(r[rate_idx])
                if v is not None:
                    campaign_stats[camp]['rate'] = v

    avg_cpc = (total_spend / total_conversions) if total_conversions > 0 else 0

    campaign_list = []
    for camp, st in campaign_stats.items():
        if st['conversions'] > 0:
            rate = st['rate'] if st['rate'] is not None else round((st['conversions'] / st['spend']) * 100, 2) if st['spend'] > 0 else 0
            cpc = round(st['spend'] / st['conversions'], 2) if st['spend'] > 0 else 0
        else:
            rate = st['rate'] if st['rate'] is not None else 0
            cpc = None
        campaign_list.append({
            'name': camp,
            'spend': round(st['spend'], 2),
            'conversions': st['conversions'],
            'clicks': st['clicks'],
            'rate': rate,
            'cpc': cpc,
        })

    def sort_key(x):
        if x['cpc'] is None:
            return (float('inf'), x['rate'])
        return (x['cpc'], x['rate'])

    campaign_list.sort(key=sort_key)

    return {
        'total_spend': round(total_spend, 2),
        'total_conversions': total_conversions,
        'avg_cpc': round(avg_cpc, 2),
        'total_clicks': total_clicks,
        'campaigns': campaign_list,
        'columns': {
            'cost': cost_col,
            'conversions': conv_col,
            'rate': rate_col,
            'campaign': camp_col,
        }
    }

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload():
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400

    f = request.files['file']
    if not f.filename.endswith('.csv'):
        return jsonify({'error': 'Only CSV files accepted'}), 400

    try:
        stream = io.StringIO(f.stream.read().decode('utf-8'))
        reader = csv.reader(stream)
        rows = list(reader)

        if len(rows) < 2:
            return jsonify({'error': 'CSV appears empty or header-only'}), 400

        headers = rows[0]
        data_rows = rows[1:]

        metrics = compute_campaign_metrics(headers, data_rows)
        total_rows = len(data_rows)

        top3 = metrics['campaigns'][:3]
        bottom3 = metrics['campaigns'][-3:] if len(metrics['campaigns']) >= 3 else metrics['campaigns']

        top3_lines = ', '.join([f"{c['name']} (${c['cpc']} cost per conversion)" for c in top3]) if top3 else 'n/a'
        bottom3_lines = ', '.join([f"{c['name']} (${c['cpc']} cost per conversion)" for c in bottom3]) if bottom3 else 'n/a'

        prompt = f"""Write a clean client-ready performance summary using ONLY the exact numbers below. Do not do any math. Do not guess. Do not invent numbers.

HEADERS DETECTED: {', '.join(headers)}
TOTAL ROWS: {total_rows}
TOTAL SPEND: {metrics['total_spend']}
TOTAL CONVERSIONS: {metrics['total_conversions']}
AVERAGE COST PER CONVERSION: {metrics['avg_cpc']}
TOTAL CLICKS: {metrics['total_clicks']}

TOP 3 CAMPAIGNS BY PERFORMANCE (lowest cost per conversion first):
{top3_lines}

BOTTOM 3 CAMPAIGNS BY PERFORMANCE (highest cost per conversion first):
{bottom3_lines}

OUTPUT FORMAT (write exactly like this, clean bullets, agency-ready tone):

• Total spend: $X | Total conversions: Y | Average cost per conversion: $Z
• Top performers: [name] ($A cost per conversion), [name] ($A cost per conversion), [name] ($A cost per conversion)
• Underperformers: [name] ($A cost per conversion), [name] ($A cost per conversion), [name] ($A cost per conversion)
• Recommendation: [1 sentence actionable advice for next month]

RULES:
- Use the exact numbers above. Do not recalculate anything.
- Keep it to 4 bullet points exactly.
- Write in plain conversational English, like a human analyst.
- No markdown headers, no extra fluff, no hedging."""

        api_key = os.getenv('GROQ_API_KEY')
        if not api_key:
            return jsonify({'error': 'Server not configured: missing GROQ_API_KEY'}), 500

        payload = {
            'model': 'llama-3.3-70b-versatile',
            'messages': [{'role': 'user', 'content': prompt}],
            'temperature': 0.3,
        }
        headers = {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
        }

        attempts = 0
        while attempts < 5:
            try:
                resp = requests.post(
                    'https://api.groq.com/openai/v1/chat/completions',
                    headers=headers,
                    json=payload,
                    timeout=30,
                )
                if resp.status_code == 429:
                    attempts += 1
                    wait = min(2 ** attempts, 10)
                    time.sleep(wait)
                    continue
                resp.raise_for_status()
                try:
                    body = resp.json()
                except ValueError:
                    return jsonify({'error': 'AI provider returned an invalid response. Please try again shortly.'}), 502
                summary = (body.get('choices', [{}])[0].get('message', {}) or {}).get('content', '').strip()
                if not summary:
                    return jsonify({'error': 'AI provider returned an empty response.'}), 502
                return jsonify({'summary': summary, 'rows_analyzed': total_rows})
            except requests.RequestException:
                attempts += 1
                if attempts >= 5:
                    raise

        return jsonify({'error': 'Rate limit exceeded. Please try again in a few seconds.'}), 429

    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)
