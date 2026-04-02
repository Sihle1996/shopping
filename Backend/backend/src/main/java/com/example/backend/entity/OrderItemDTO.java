package com.example.backend.entity;

import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
public class OrderItemDTO {
    private UUID productId;
    private String name;
    private double price;
    private int quantity;
    private String size;
    private String specialInstructions;
    /** Selected modifier choices — each entry: { groupName, choiceLabel, priceModifier } */
    private List<SelectedChoiceDTO> selectedChoices;

    @Data
    public static class SelectedChoiceDTO {
        private String groupName;
        private String choiceLabel;
        private Double priceModifier;
    }
}
