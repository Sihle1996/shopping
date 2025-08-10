package com.example.backend.repository;


import com.example.backend.entity.Order;
import com.example.backend.user.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

@Repository
public interface OrderRepository extends JpaRepository<Order, Long> {
    List<Order> findByUserId(Long userId);
    List<Order> findByStatus(String status);
    List<Order> findByDriver(User driver);
    List<Order> findByOrderDateBetween(Instant start, Instant end);

}

