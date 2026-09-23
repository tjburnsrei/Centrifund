import { handle } from '../server/handler.js';

// Native Web Standard entry point avoids differences in Node request-body helpers.
export default { fetch: handle };
