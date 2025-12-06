import { Client } from '@notionhq/client';
import { NotionToMarkdown } from 'notion-to-md';
import * as dotenv from 'dotenv';
dotenv.config();

const notion = new Client({
  auth: process.env.NOTION_TOKEN,
});

const n2m = new NotionToMarkdown({ notionClient: notion });

console.log('🔍 Notion 페이지 내용 테스트 중...\n');

try {
  const response = await notion.databases.query({
    database_id: process.env.NOTION_DATABASE_ID,
  });
  
  console.log(`✅ ${response.results.length}개 페이지 찾음\n`);
  
  if (response.results.length > 0) {
    const firstPage = response.results[0];
    const pageId = firstPage.id;
    
    console.log('첫 번째 페이지:');
    console.log('  ID:', pageId);
    console.log('  제목:', firstPage.properties.Title?.title[0]?.plain_text);
    console.log('');
    
    // 페이지 내용 가져오기
    console.log('📄 페이지 내용 가져오는 중...\n');
    const mdBlocks = await n2m.pageToMarkdown(pageId);
    const mdString = n2m.toMarkdownString(mdBlocks);
    
    console.log('내용 미리보기:');
    console.log(mdString.parent.substring(0, 500));
    console.log('\n✅ 페이지 내용 가져오기 성공!');
  }
} catch (error) {
  console.error('❌ 에러:', error.message);
}

