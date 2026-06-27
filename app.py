from flask import Flask, request, jsonify, render_template
import json

app = Flask(__name__)

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
        import csv, io, os, requests
        stream = io.StringIO(f.stream.read().decode('utf-8'))
        reader = csv.reader(stream)
        rows = list(reader)

        if len(rows) < 2:
            return jsonify({'error': 'CSV appears empty or header-only'}), 400

        headers = rows[0]
        data_rows = rows[1:]
        sample = '\n'.join([', '.join(r) for r in data_rows[:20]])

        prompt = f"""You are a senior data analyst writing directly to a business owner/client. Below are sample rows from their CSV file.
Headers: {', '.join(headers)}
Rows:
{sample}

Write ONE short executive summary paragraph (3-6 sentences) in plain, conversational English.

Rules:
- Start with the single most important number or insight.
- Mention totals, averages, or standout figures naturally.
- Give a clear verdict: is this data showing good performance, average performance, or something to fix?
- End with 1-2 concrete, actionable recommendations the client can do next month.
- Sound like a helpful human analyst, not a bot. Use contractions, be direct, avoid jargon.
- No bullet lists, no numbered sections, no markdown formatting. Just one flowing paragraph."""

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

        return jsonify({'summary': summary, 'rows_analyzed': min(len(data_rows), 20)})

    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)