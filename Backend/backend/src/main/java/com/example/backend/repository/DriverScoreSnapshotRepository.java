package com.example.backend.repository;

import com.example.backend.entity.DriverScoreSnapshot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Repository
public interface DriverScoreSnapshotRepository extends JpaRepository<DriverScoreSnapshot, UUID> {
    boolean existsByDriverIdAndSnapshotDate(UUID driverId, LocalDate snapshotDate);
    List<DriverScoreSnapshot> findByDriverIdOrderBySnapshotDateAsc(UUID driverId);
}
