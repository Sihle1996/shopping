package com.example.backend.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "menu_item_option_groups")
public class MenuItemOptionGroup {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "menu_item_id", nullable = false)
    @JsonIgnore
    private MenuItem menuItem;

    @Column(nullable = false)
    private String name;

    /** RADIO = pick exactly one, CHECKBOX = pick any/multiple */
    @Column(nullable = false)
    private String type = "RADIO";

    @Column(nullable = false)
    private Boolean required = false;

    @Column(nullable = false)
    private Integer sortOrder = 0;

    @OneToMany(mappedBy = "optionGroup", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @OrderBy("sortOrder ASC")
    private List<MenuItemOptionChoice> choices = new ArrayList<>();
}
