export const MARKER_BEGIN = '<!-- BEGIN dev-workflows -->';
export const MARKER_END = '<!-- END dev-workflows -->';

export function mergeMarkedContent(existingContent: string | null, newBlock: string): string {
  const markedBlock = `${MARKER_BEGIN}\n${newBlock}${MARKER_END}\n`;

  if (existingContent === null) {
    return markedBlock;
  }

  const beginIndex = existingContent.indexOf(MARKER_BEGIN);
  const endIndex = existingContent.indexOf(MARKER_END);

  if (beginIndex !== -1 && endIndex !== -1) {
    const before = existingContent.slice(0, beginIndex);
    const afterEndLine = existingContent.indexOf('\n', endIndex);
    const after = afterEndLine !== -1 ? existingContent.slice(afterEndLine + 1) : '';
    return `${before}${markedBlock}${after}`;
  }

  return `${existingContent}\n${markedBlock}`;
}

export function removeMarkedBlock(existingContent: string): string {
  const beginIndex = existingContent.indexOf(MARKER_BEGIN);
  const endIndex = existingContent.indexOf(MARKER_END);

  if (beginIndex === -1 || endIndex === -1) {
    return existingContent;
  }

  const before = existingContent.slice(0, beginIndex);
  const afterEndLine = existingContent.indexOf('\n', endIndex);
  const after = afterEndLine !== -1 ? existingContent.slice(afterEndLine + 1) : '';

  const result = `${before}${after}`.replace(/\n{3,}/g, '\n\n').trim();
  return result;
}
