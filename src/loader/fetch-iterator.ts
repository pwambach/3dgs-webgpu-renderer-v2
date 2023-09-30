export const fetchIterator = (url: string) => ({
  url,
  async getReader() {
    const body = await fetch(this.url).then((res) => res.body);

    if (!body) {
      throw new Error("Request failed! Response has no body.");
    }

    return body.getReader();
  },

  async *[Symbol.asyncIterator]() {
    const reader = await this.getReader();

    try {
      while (true) {
        const { done, value: chunk } = await reader.read();

        if (done) return;

        yield chunk;
      }
    } finally {
      reader.releaseLock();
    }
  },
});
