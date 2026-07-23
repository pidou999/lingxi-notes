import { extractContent } from './src/lib/content-extractor';  
const fs = await import('fs');  
const html = fs.readFileSync('../../temp-tencent.html', 'utf-8');  
const result = await extractContent(html, 'https://cloud.tencent.com/developer/article/2635777');  
console.log('Title:', result.title);  
console.log('Text length:', result.text.length);  
console.log('Content HTML length:', result.contentHtml.length);  
console.log('Content preview:', result.contentHtml.substring(0, 500));  
