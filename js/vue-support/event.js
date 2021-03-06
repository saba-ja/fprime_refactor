/**
 * vue-support/event.js:
 *
 * Event listing support for F´ that sets up the Vue.js components used to display events. These components allow the
 * user to render events. This file also provides EventMixins, which are the core functions needed to convert events to
 * something Vue.js can display. These should be mixed with any F´ objects wrapping Vue.js component creation.
 *
 * @author mstarch
 */
import { filter, timeToString } from "./utils.js";
import { config } from "../config.js";

let OPREG = /Opcode (0x\d+)/;

/**
 * events-list:
 *
 * Renders lists as a colorized table. This is a thin-wrapper to pass events to the fp-table component. It supplies the
 * needed method to configure fp-table to render events.
 */
Vue.component("event-list", {
    props: ["events", "commands"],
    template: "#event-list-template",
    data: function () {
        return {
            event_table_header: [
                { "text": "Event Time", "value": "event_time" },
                { "text": "Event Id", "value": "event_id" },
                { "text": "Event Name", "value": "event_name" },
                { "text": "Event Severity", "value": "event_severity" },
                { "text": "Event Description", "value": "event_description" }]
        }
    },
    methods: {


        /**
     * Use the row's values and bounds to colorize the row. This function will color red and yellow items using
     * the boot-strap "warning" and "danger" calls.
     * @param item: item passed in with which to calculate style
     * @return {string}: style-class to use
     */
        get_style(item) {
            let severity = {
                "FATAL": "fp-color-fatal",
                "WARNING_HI": "fp-color-warn-hi",
                "WARNING_LO": "fp-color-warn-lo",
                "ACTIVITY_HI": "fp-color-act-hi",
                "ACTIVITY_LO": "fp-color-act-lo",
                "COMMAND": "fp-color-command",
                "DIAGNOSTIC": ""
            }
            return severity[item.event_severity];
        },
        /**
         * A function to clear the events pane to remove events that have already been seen. Note: this action is
         * irrecoverable.
         */
        clearEvents() {
            return this.events.splice(0, this.events.length);
        }
    }
});
/**
 * EventMixins:
 *
 * This set of functions should be mixed in as member functions to the F´ wrappers around the above Vue.js component.
 * These provide the functions required to update events on the fly.
 *
 * Note: to mixin these functions: Object.assign(EventMixins)
 */
export let EventMixins = {

    /**
    * Takes in a given event item, and harvests out the column values for display in the fp-table.
    * @param item: event object to harvest
    * @return {[string, *, *, void | string, *]}
    */
    columnify(item) {
        let display_text = item.display_text;
        // Remap command EVRs to expand opcode for visualization pruposes
        let groups = null
        if (item.template.severity.value == "Severity.COMMAND" && (groups = display_text.match(OPREG)) != null) {
            let mnemonic = "UNKNOWN";
            let id = parseInt(groups[1]);
            for (let command in this.commands) {
                command = this.commands[command];
                if (command.id == id) {
                    mnemonic = command.mnemonic;
                }
            }
            display_text = display_text.replace(OPREG, "(" + groups[0] + ") " + mnemonic + " ");
        }
        const result = {
            "event_time": timeToString(item.time),
            "event_id": "0x" + item.id.toString(16),
            "event_name": item.template.full_name,
            "event_severity": item.template.severity.value.replace("Severity.", ""),
            "event_description": display_text
        }
        return result;

        // return [timeToString(item.time), "0x" + item.id.toString(16), item.template.full_name,
        // item.template.severity.value.replace("Severity.", ""), display_text];
    },
    /**
    * Take the given item and converting it to a unique key by merging the id and time together with a prefix
    * indicating the type of the item. Also strip spaces.
    * @param item: item to convert
    * @return {string} unique key
    */
    keyify(item) {
        return "evt-" + item.id + "-" + item.time.seconds + "-" + item.time.microseconds;
    },
    /**
     * Update the list of events with the supplied new list of events.
     * @param newEvents: new full list of events to render
     */
    updateEvents(newEvents) {
        let timeout = config.dataTimeout * 1000;
        for (const obj of newEvents) {
            const new_key = this.keyify(obj);
            const new_obj = { ...this.columnify(obj), 'key': new_key };
            this.vue.events.push(new_obj);
        }

        // this.vue.events.push(...newEvents);

        // Set active events, and register a timeout to turn it off again
        if (newEvents.length > 0) {
            let vue_self = this.vue;
            vue_self.eventsActive = true;
            clearTimeout(this.eventTimeout);
            this.eventTimeout = setTimeout(() => vue_self.eventsActive = false, timeout);
        }
    },
    /**
     * Sets up the needed event data items.
     * @return {[], []} an empty list to fill with events
     */
    setupEvents() {
        return { "events": [], "eventsActive": false };
    }
};

/**
 * EventView:
 *
 * A wrapper for the event-list viewable. This is stand-alone and could be used anywhere that an events list is needed.
 * It will setup the Vue.js component and mixin the above needed functions.
 *
 * @author mstarch
 */
export class EventView {
    /**
     * Creates a ChannelView that delegates to a Vue.js view.
     * @param elemid: HTML ID of the element to render to
     */
    constructor(elemid) {
        Object.assign(EventView.prototype, EventMixins);
        this.vue = new Vue({
            el: elemid,
            data: this.setupEvents()
        });
    }

}
