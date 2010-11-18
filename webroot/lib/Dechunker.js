/**
  * Dechunker - process streamed XHR responseText for messages
  *
  * @param options.separator (RegEx | String) Separator string. default="\n"
  * @param options.onMessage (callback)  Invoked when a new message
  *                                      detected
  * @param options.onChunk (callback)    Invoked when new chunk of data
  *                                      encountered
  */
function nilf() {}
function Dechunker(options) {
  var data = [];
  var cursor = 0;
  options = options || {};

  this.process = function(xhr) {
    var text = (typeof(xhr.responseText) == 'string') &&
    xhr.responseText;
    // Only act if there's (new) data
    if (text && text.length > cursor) {
      // Get the unprocessed portion
      var chunk = text.substring(cursor);
      cursor = text.length;

      (options.onChunk || nilf)(chunk); // callback

      // Munge residual and new chunk to find complete messages
      data.push(chunk);
      data = data.join('').split(options.seperator || '\n');

      // Process each complete message
      while (data.length > 1) {
        var msg = data.shift();
        try {
          var evaledMsg = JSON.parse(msg);
          msg = evaledMsg;
        } catch (e) {
          // Pass un-eval'ed msg
        }
        (options.onMessage || nilf)(msg); // callback
      }
    }
  };
}
