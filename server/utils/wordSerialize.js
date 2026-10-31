export function mapRootSummary(root) {
  return { id: root.id, name: root.name, meaning: root.meaning };
}

export function serializeWord(word, extra = {}) {
  const json = word.toJSON();
  delete json.reviews;
  const roots = (word.roots || json.roots || []).map(mapRootSummary);
  const review = word.reviews?.[0];
  const payload = {
    ...json,
    roots,
    exampleCount: extra.exampleCount ?? 0,
    status: review?.status ?? extra.status ?? null,
  };
  if (extra.examples !== undefined) {
    payload.examples = extra.examples;
  } else {
    delete payload.examples;
  }
  return payload;
}
