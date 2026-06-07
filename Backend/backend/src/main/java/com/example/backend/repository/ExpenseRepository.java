package com.example.backend.repository;

import com.example.backend.entity.Expense;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ExpenseRepository extends JpaRepository<Expense, UUID> {
    List<Expense> findByTenant_IdOrderByIncurredOnDesc(UUID tenantId);
    Optional<Expense> findByIdAndTenant_Id(UUID id, UUID tenantId);
}
