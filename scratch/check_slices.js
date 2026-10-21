const fs = require('fs');
const readline = require('readline');

const filePath = 'C:/Users/mayur/.gemini/antigravity/brain/6c490fe2-bed9-4e70-ac98-7ec06d0a2c9b/.system_generated/logs/transcript.jsonl';
const rl = readline.createInterface({ input: fs.createReadStream(filePath) });

rl.on('line', (line) => {
  try {
    const data = JSON.parse(line);
    if (data.source === 'USER_EXPLICIT' && data.type === 'USER_INPUT') {
      const content = data.content || '';
      if (content.includes('Slice 5') || content.includes('5D') || content.includes('5E') || content.includes('5A') || content.includes('5B') || content.includes('5C')) {
        const cleaned = content.replace(/<[^>]*>/g, '').trim().replace(/\s+/g, ' ');
        console.log(`Step ${data.step_index}: ${cleaned.substring(0, 120)}`);
      }
    }
  } catch (err) {}
});
