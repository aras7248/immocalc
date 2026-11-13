declare module "mammoth" {
  export type RawTextResult = {
    value: string;
    messages: Array<{ type: string; message: string }>;
  };

  export function extractRawText(input: { buffer: Buffer }): Promise<RawTextResult>;
}

declare module "mammoth/mammoth.browser.js" {
  export function extractRawText(input: { arrayBuffer: ArrayBuffer }): Promise<{ value: string }>;
}
