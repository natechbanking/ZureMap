/// <reference lib="webworker" />

addEventListener('message', async ({ data }) => {
  try {
    const ELK = (await import('elkjs/lib/elk.bundled.js')).default;
    const elk = new (ELK as new () => { layout(g: unknown): Promise<unknown> })();
    const result = await elk.layout(data);
    postMessage(result);
  } catch (err) {
    postMessage({ error: String(err) });
  }
});
