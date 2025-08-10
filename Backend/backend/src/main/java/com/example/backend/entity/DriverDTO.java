package com.example.backend.entity;

import com.example.backend.user.DriverStatus;
import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class DriverDTO {
    private Long id;
    private String email;
    private DriverStatus driverStatus;
}
