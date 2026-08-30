package com.training.tracking.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.util.UUID;

@Entity
@Table(name = "exercise")
public class Exercise {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** The client-generated uid, unique within its block rather than globally. */
    @Column(name = "client_id", nullable = false, length = 32)
    private String clientId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "block_id", nullable = false)
    private Block block;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false, length = 16)
    private String type;

    @Column(nullable = false)
    private boolean uni;

    private Integer sets;

    @Column(name = "sets_l")
    private Integer setsL;

    @Column(name = "sets_r")
    private Integer setsR;

    @Column(nullable = false, length = 64)
    private String reps;

    @Column(columnDefinition = "TEXT")
    private String note;

    @Column(columnDefinition = "TEXT")
    private String description;

    /**
     * The setup photo, or null. A plain id rather than an association: the image outlives the
     * delete-and-recreate of {@code PUT /api/state} that this row does not, so the reference only
     * ever travels in one direction.
     */
    @Column(name = "image_id")
    private UUID imageId;

    @Column(nullable = false)
    private int position;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getClientId() { return clientId; }
    public void setClientId(String clientId) { this.clientId = clientId; }

    public Block getBlock() { return block; }
    public void setBlock(Block block) { this.block = block; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public boolean isUni() { return uni; }
    public void setUni(boolean uni) { this.uni = uni; }

    public Integer getSets() { return sets; }
    public void setSets(Integer sets) { this.sets = sets; }

    public Integer getSetsL() { return setsL; }
    public void setSetsL(Integer setsL) { this.setsL = setsL; }

    public Integer getSetsR() { return setsR; }
    public void setSetsR(Integer setsR) { this.setsR = setsR; }

    public String getReps() { return reps; }
    public void setReps(String reps) { this.reps = reps; }

    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public UUID getImageId() { return imageId; }
    public void setImageId(UUID imageId) { this.imageId = imageId; }

    public int getPosition() { return position; }
    public void setPosition(int position) { this.position = position; }
}
