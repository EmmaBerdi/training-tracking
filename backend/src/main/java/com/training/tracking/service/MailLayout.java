package com.training.tracking.service;

import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.web.util.HtmlUtils;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Renders a {@link MailContent} as the HTML part (from {@code mail/layout.html}, dark like the app)
 * and as the matching plain-text part.
 */
@Component
public class MailLayout {

    private static final Pattern PLACEHOLDER = Pattern.compile("\\{\\{(\\w+)}}");
    private static final List<String> FOOTER = List.of(
            "Diese E-Mail wurde automatisch von Training versendet.",
            "Antworten an diese Adresse werden nicht gelesen.");

    private final String template;

    public MailLayout() {
        try {
            template = new ClassPathResource("mail/layout.html").getContentAsString(StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    public String html(MailContent content) {
        Map<String, String> values = Map.of(
                "subject", escape(content.subject()),
                "heading", escape(content.heading()),
                "paragraphs", content.paragraphs().stream()
                        .map(p -> "<p style=\"margin:0 0 16px;\">" + escape(p) + "</p>")
                        .collect(Collectors.joining("\n")),
                "code", escape(content.code()),
                "validity", escape(content.validity()),
                "note", escape(content.note()),
                "footer", FOOTER.stream().map(MailLayout::escape).collect(Collectors.joining("<br>")));
        // One pass, so a value that happens to contain {{…}} is never substituted again.
        return PLACEHOLDER.matcher(template).replaceAll(match -> {
            String value = values.get(match.group(1));
            if (value == null) {
                throw new IllegalStateException("mail/layout.html has no value for " + match.group());
            }
            return Matcher.quoteReplacement(value);
        });
    }

    public String text(MailContent content) {
        StringBuilder text = new StringBuilder("TRAINING\n").append(content.heading()).append("\n\n");
        content.paragraphs().forEach(p -> text.append(p).append("\n\n"));
        text.append("    ").append(content.code()).append("\n\n")
                .append(content.validity()).append("\n\n")
                .append(content.note()).append("\n\n")
                .append("--\n");
        FOOTER.forEach(line -> text.append(line).append('\n'));
        return text.toString();
    }

    private static String escape(String value) {
        return HtmlUtils.htmlEscape(value, StandardCharsets.UTF_8.name());
    }
}
