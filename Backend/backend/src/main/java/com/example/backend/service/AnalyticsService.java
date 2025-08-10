package com.example.backend.service;

import com.example.backend.entity.Order;
import com.example.backend.entity.OrderItem;
import com.example.backend.entity.SalesTrendDTO;
import com.example.backend.entity.TopProductDTO;
import com.example.backend.repository.OrderRepository;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class AnalyticsService {
    private final OrderRepository orderRepository;

    public AnalyticsService(OrderRepository orderRepository) {
        this.orderRepository = orderRepository;
    }

    public List<SalesTrendDTO> getSalesTrends(Instant start, Instant end) {
        List<Order> orders = orderRepository.findByOrderDateBetween(start, end);
        Map<LocalDate, Double> map = new TreeMap<>();
        for (Order order : orders) {
            LocalDate date = LocalDate.ofInstant(order.getOrderDate(), ZoneId.systemDefault());
            map.merge(date, order.getTotalAmount(), Double::sum);
        }
        return map.entrySet().stream()
                .map(e -> new SalesTrendDTO(e.getKey().toString(), e.getValue()))
                .collect(Collectors.toList());
    }

    public List<TopProductDTO> getTopProducts(Instant start, Instant end) {
        List<Order> orders = orderRepository.findByOrderDateBetween(start, end);
        Map<String, Long> counts = new HashMap<>();
        for (Order order : orders) {
            for (OrderItem item : order.getOrderItems()) {
                String name = item.getMenuItem().getName();
                counts.merge(name, (long) item.getQuantity(), Long::sum);
            }
        }
        return counts.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .limit(5)
                .map(e -> new TopProductDTO(e.getKey(), e.getValue()))
                .collect(Collectors.toList());
    }

    public double getAverageOrderValue(Instant start, Instant end) {
        List<Order> orders = orderRepository.findByOrderDateBetween(start, end);
        if (orders.isEmpty()) return 0;
        double total = orders.stream().mapToDouble(Order::getTotalAmount).sum();
        return total / orders.size();
    }

    public double getOnTimePercentage(Instant start, Instant end) {
        List<Order> orders = orderRepository.findByOrderDateBetween(start, end);
        if (orders.isEmpty()) return 0;
        long delivered = orders.stream().filter(o -> "Delivered".equalsIgnoreCase(o.getStatus())).count();
        return (delivered * 100.0) / orders.size();
    }

    public double getCancellationRate(Instant start, Instant end) {
        List<Order> orders = orderRepository.findByOrderDateBetween(start, end);
        if (orders.isEmpty()) return 0;
        long cancelled = orders.stream().filter(o -> "Cancelled".equalsIgnoreCase(o.getStatus())).count();
        return (cancelled * 100.0) / orders.size();
    }
}
