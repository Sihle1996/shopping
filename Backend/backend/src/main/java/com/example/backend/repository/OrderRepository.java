package com.example.backend.repository;


import com.example.backend.entity.Order;
import com.example.backend.entity.TopProductDTO;
import com.example.backend.user.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Repository
public interface OrderRepository extends JpaRepository<Order, UUID> {
    List<Order> findByUserId(UUID userId);
    List<Order> findByStatus(String status);
    List<Order> findByStatusAndTenant_Id(String status, UUID tenantId);
    List<Order> findByDriver(User driver);
    List<Order> findByOrderDateBetween(Instant start, Instant end);
    Page<Order> findByUserEmailContainingIgnoreCase(String email, Pageable pageable);
    Page<Order> findByTenant_Id(UUID tenantId, Pageable pageable);
    Page<Order> findByUserEmailContainingIgnoreCaseAndTenant_Id(String email, UUID tenantId, Pageable pageable);
    List<Order> findByUserIdAndTenant_Id(UUID userId, UUID tenantId);

    @Query("SELECT new com.example.backend.entity.TopProductDTO(oi.menuItem.name, SUM(oi.quantity)) " +
           "FROM Order o JOIN o.orderItems oi " +
           "WHERE o.status = 'Delivered' AND o.orderDate BETWEEN :start AND :end " +
           "GROUP BY oi.menuItem.name ORDER BY SUM(oi.quantity) DESC")
    List<TopProductDTO> findTopProducts(@Param("start") Instant start, @Param("end") Instant end, Pageable pageable);

    List<Order> findByTenant_Id(UUID tenantId);
}
