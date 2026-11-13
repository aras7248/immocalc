declare module "mammoth" {
  export type RawTextResult = {
    value: string;
    messages: Array<{ type: string; message: string }>;
  };

  export function extractRawText(input: { buffer: Buffer }): Promise<RawTextResult>;
}
