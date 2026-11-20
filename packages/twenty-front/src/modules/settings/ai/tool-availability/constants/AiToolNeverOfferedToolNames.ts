// Mirror of mcp-excluded-tool-names.constant.ts and ai-chat-excluded-tool-names.const.ts; can drift.
export const AI_TOOL_NEVER_OFFERED_TOOL_NAMES = {
  mcp: new Set([
    'code_interpreter',
    'http_request',
    'read_file',
    'extract_json_paths',
    'search_output',
  ]),
  agents: new Set(['create_file_upload', 'complete_file_upload']),
};
