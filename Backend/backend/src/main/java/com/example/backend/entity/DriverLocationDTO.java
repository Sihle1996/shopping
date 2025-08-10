package com.example.backend.entity;

import com.example.backend.user.DriverStatus;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class DriverLocationDTO {
    private Long id;
    private String email;
    private DriverStatus driverStatus;
    private Double latitude;
    private Double longitude;
    private Double speed;
    private Instant lastPing;
}
