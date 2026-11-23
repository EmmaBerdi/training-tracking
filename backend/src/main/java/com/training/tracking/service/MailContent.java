package com.training.tracking.service;

import java.util.List;

/**
 * One mail in the app's layout ({@link MailLayout}): a heading, paragraphs, the highlighted code or
 * button with how long it holds, and a closing note in small print. Plain text throughout; the
 * layout escapes it for the HTML part.
 */
public record MailContent(String subject,
                          String heading,
                          List<String> paragraphs,
                          Highlight highlight,
                          String validity,
                          String note) {

    /** What the mail is for, set apart from the paragraphs. */
    public sealed interface Highlight {
    }

    /** Something to type in, large in the accent colour. */
    public record Code(String value) implements Highlight {
    }

    /** A link to follow, as a button; the address is printed below it for mail apps that drop buttons. */
    public record Button(String label, String url) implements Highlight {
    }
}
