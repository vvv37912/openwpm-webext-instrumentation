import MessageSender = browser.runtime.MessageSender;
import { incrementedEventOrdinal } from "../lib/extension-session-event-ordinal";
import { extensionSessionUuid } from "../lib/extension-session-uuid";
import { boolToInt, escapeString, escapeUrl } from "../lib/string-utils";
import { JavascriptOperation } from "../schema";

export class JavascriptInstrument {
  private readonly dataReceiver;
  private onMessageListener;

  constructor(dataReceiver) {
    this.dataReceiver = dataReceiver;
  }

  public run(crawlID) {
    const processCallsAndValues = (data, sender: MessageSender) => {
      const update = {} as JavascriptOperation;
      update.crawl_id = crawlID;
      update.extension_session_uuid = extensionSessionUuid;
      update.event_ordinal = incrementedEventOrdinal();
      update.page_scoped_event_ordinal = data.ordinal;
      update.window_id = sender.tab.windowId;
      update.tab_id = sender.tab.id;
      update.frame_id = sender.frameId;
      update.script_url = escapeUrl(data.scriptUrl);
      update.script_line = escapeString(data.scriptLine);
      update.script_col = escapeString(data.scriptCol);
      update.func_name = escapeString(data.funcName);
      update.script_loc_eval = escapeString(data.scriptLocEval);
      update.call_stack = escapeString(data.callStack);
      update.symbol = escapeString(data.symbol);
      update.operation = escapeString(data.operation);
      update.value = escapeString(data.value);
      update.time_stamp = data.timeStamp;
      update.incognito = boolToInt(sender.tab.incognito);

      // document_url is the current frame's document href
      // top_level_url is the top-level frame's document href
      update.document_url = escapeUrl(sender.url);
      update.top_level_url = escapeUrl(sender.tab.url);

      if (data.operation === "call" && data.args.length > 0) {
        update.arguments = escapeString(JSON.stringify(data.args));
      }

      this.dataReceiver.saveRecord("javascript", update);
    };

    // Listen for messages from content script injected to instrument JavaScript API
    this.onMessageListener = (msg, sender) => {
      // console.debug("javascript-instrumentation background listener - msg, sender, sendReply", msg, sender, sendReply);
      if (msg.namespace && msg.namespace === "javascript-instrumentation") {
        switch (msg.type) {
          case "logCall":
          case "logValue":
            processCallsAndValues(msg.data, sender);
            break;
        }
      }
    };
    browser.runtime.onMessage.addListener(this.onMessageListener);
  }

  public cleanup() {
    if (this.onMessageListener) {
      browser.runtime.onMessage.removeListener(this.onMessageListener);
    }
  }
}
