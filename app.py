from flask import Flask, request, jsonify, render_template
import json, csv, io, os, requests
from collections import Counter

app = Flask(__name__)

def to_num(v):
    try:
        if '.' in v:
            return float(v)
        return int(v)
    except:
        return None

def compute_stats(headers, rows):
    stats = {}
    for idx, h in enumerate(headers):
        vals = [r[idx] for r in rows if len(r) > idx and r[idx].strip() != '']
        nums = [to_num(v) for v in vals]
        nums = [n for n in nums if n is not None]
        entry = {'count': len(vals), 'numeric_count': len(nums)}
        if nums:
            entry['sum'] = sum(nums)
            entry['avg'] = round(sum(nums) / len(nums), 2)
            entry['min'] = min(nums)
            entry['max'] = max(nums)
        cats = [v for v in vals if to_num(v) is None]
        if cats:
            top = Counter(cats).most_common(5)
            entry['top_categories'] = [{'value': k, 'count': c} for k, c in top]
        stats[h] = entry
    return stats

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
        sample = '\n'.join([', '.join(r) for r in data_rows[:15]])
        stats = compute_stats(headers, data_rows)

        stats_lines = []
        for h, s in stats.items():
            line = f'{h}: {s["count"]} rows'
            if s.get('numeric_count'):
                line += f', sum={s["sum"]}, avg={s["avg"]}, min={s["min"]}, max={s["max"]}'
            if s.get('top_categories'):
                tops = ', '.join([f'{t["value"]} ({t["count"]})' for t in s['top_categories']])
                line += f', top categories: {tops}'
            stats_lines.append(line)
        stats_block = '\n'.join(stats_lines)

        prompt = f"""You are a senior data analyst writing directly to a business owner/client. Below are sample rows from their CSV file and precomputed statistics for each column.

HEADERS: {', '.join(headers)}

SAMPLE ROWS (first 15):
{sample}

PRECOMPUTED STATS (ground truth, MUST use these exact numbers):
{stats_block}

Write a concise client-ready report in this EXACT format using ONLY the provided stats:

• Total spend, total conversions, average cost per conversion
• Top 3 campaigns by performance
• Bottom 3 campaigns by performance
• One clear recommendation for next month

Rules:
- Use bullet points exactly as shown above.
- Keep wording plain and conversational, like a helpful human analyst.
- No markdown headers, no numbering, no extra fluff.
- Do not invent numbers. If you mention a metric, it must match the precomputed stats exactly."""

        api_key = os.getenv('GROQ_API_KEY')
        if not api_key:
            return jsonify({'error': 'Server not configured: missing GROQ_API_KEY'}), 500

        resp = requests.post(
            'https://api.groq.com/openai/v1/chat/completions',
            headers={
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json',
            },
            json={
                'model': 'llama-3.3-70b-versatile',
                'messages': [{'role': 'user', 'content': prompt}],
                'temperature': 0.3,
            },
            timeout=30,
        )
        resp.raise_for_status()
        summary = resp.json()['choices'][0]['message']['content'].strip()

        return jsonify({'summary': summary, 'rows_analyzed': len(data_rows)})

    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)
