/// <reference types="astro/client" />

// Mermaid 전역 타입 선언
declare global {
  interface Window {
    mermaid?: {
      initialize: (config: any) => void;
      render: (id: string, code: string) => Promise<{ svg: string }>;
    };
  }

  // 전역 mermaid 변수 선언
  const mermaid: {
    initialize: (config: any) => void;
    render: (id: string, code: string) => Promise<{ svg: string }>;
  } | undefined;
}

export {};

