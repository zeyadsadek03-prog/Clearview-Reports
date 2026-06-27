from flask import Flask, request, jsonify, render_template

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

Write a clear, concise plain-English summary of what this data likely represents.
Include: totals/counts, notable trends or patterns, and any outliers.
Output in 3-6 short paragraphs."""

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
        summary = resp.json()['choices'][0]['message']['content']

        return jsonify({'summary': summary, 'rows_analyzed': min(len(data_rows), 20)})

    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)