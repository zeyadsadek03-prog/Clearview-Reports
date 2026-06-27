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

        prompt = f"""You are a data analyst. Below are the first 20 rows of a CSV file.
Headers: {', '.join(headers)}
Rows:
{sample}

Return ONLY a JSON object with this exact shape and nothing else:
{{"sections": [{{"title": "...", "content": "..."}}]}}

Required sections (use these exact titles):
1. Overview of the Data
2. Totals and Counts
3. Key Figures and Patterns
4. Outliers and Anomalies

If a section has no relevant insight, return an empty string for content."""

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
                'response_format': {'type': 'json_object'},
            },
            timeout=30,
        )
        resp.raise_for_status()
        raw = resp.json()['choices'][0]['message']['content']
        parsed = json.loads(raw)
        sections = parsed.get('sections', [])
        return jsonify({'sections': sections, 'rows_analyzed': min(len(data_rows), 20)})

    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)