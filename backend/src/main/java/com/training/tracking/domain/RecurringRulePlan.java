package com.training.tracking.domain;

import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MapsId;
import jakarta.persistence.Table;

/**
 * One workout plan a series can put on a generated date. {@code position} is a weekday index
 * (Mo=0 … So=6) when the rule's plan mode is {@code weekday}, and a cycle step when it is
 * {@code rotation}; a {@code fixed} rule has no rows here and uses its own day_key.
 */
@Entity
@Table(name = "recurring_rule_plan")
public class RecurringRulePlan {

    @EmbeddedId
    private RecurringRulePlanId id;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("ruleId")
    @JoinColumn(name = "rule_id")
    private RecurringRule rule;

    /** Client-facing id of the plan; see {@link PlannedSession#getDayKey()} for why it is the key. */
    @Column(name = "day_key", nullable = false, length = 16)
    private String dayKey;

    public RecurringRulePlan() { }

    public RecurringRulePlan(RecurringRule rule, short position, String dayKey) {
        this.rule = rule;
        this.id = new RecurringRulePlanId(rule.getId(), position);
        this.dayKey = dayKey;
    }

    public RecurringRulePlanId getId() { return id; }
    public void setId(RecurringRulePlanId id) { this.id = id; }

    public RecurringRule getRule() { return rule; }
    public void setRule(RecurringRule rule) { this.rule = rule; }

    public String getDayKey() { return dayKey; }
    public void setDayKey(String dayKey) { this.dayKey = dayKey; }

    public short getPosition() { return id.getPosition(); }
}
