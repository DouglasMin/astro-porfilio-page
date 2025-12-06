import { Client } from '@notionhq/client';
import { NotionToMarkdown } from 'notion-to-md';

const notion = new Client({
  auth: import.meta.env.NOTION_TOKEN || process.env.NOTION_TOKEN,
});

const n2m = new NotionToMarkdown({ notionClient: notion });

// Callout 블록 커스텀 변환
n2m.setCustomTransformer('callout', async (block) => {
  const { callout } = block as any;
  if (!callout || !callout.rich_text) return '';
  
  const text = callout.rich_text.map((t: any) => t.plain_text).join('');
  const icon = callout.icon?.emoji || '💡';
  
  // blockquote 형식으로 변환 (나중에 HTML에서 감지 가능하도록)
  return `> ${icon} ${text}`;
});

// Toggle 블록도 마크다운으로 변환
n2m.setCustomTransformer('toggle', async (block) => {
  const { toggle } = block as any;
  if (!toggle || !toggle.rich_text) return '';
  
  const summary = toggle.rich_text.map((t: any) => t.plain_text).join('');
  return `<details class="notion-toggle"><summary>${summary}</summary>\n\n</details>`;
});

export interface BlogPost {
  id: string;
  title: string;
  description: string;
  publishedAt: Date;
  tags: string[];
  content: string;
}

export async function getNotionBlogPosts(): Promise<BlogPost[]> {
  const databaseId = import.meta.env.NOTION_DATABASE_ID || process.env.NOTION_DATABASE_ID;
  
  if (!databaseId) {
    console.warn('NOTION_DATABASE_ID not set');
    return [];
  }

  try {
    const response = await notion.databases.query({
      database_id: databaseId,
      filter: {
        property: 'Published',
        checkbox: { equals: true },
      },
      sorts: [{ property: 'Published Date', direction: 'descending' }],
    });

    const posts = await Promise.all(
      response.results.map(async (page: any) => {
        const mdBlocks = await n2m.pageToMarkdown(page.id);
        const mdString = n2m.toMarkdownString(mdBlocks);

        return {
          id: page.id,
          title: page.properties.Title?.title[0]?.plain_text || '',
          description: page.properties.Description?.rich_text[0]?.plain_text || '',
          publishedAt: new Date(page.properties['Published Date']?.date?.start || Date.now()),
          tags: page.properties.Tags?.multi_select?.map((t: any) => t.name) || [],
          content: mdString.parent || '',
        };
      })
    );

    return posts;
  } catch (error) {
    console.error('Notion API Error:', error);
    return [];
  }
}

