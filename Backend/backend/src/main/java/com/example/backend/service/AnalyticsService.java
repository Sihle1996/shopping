package com.example.backend.service;

import com.example.backend.entity.Order;
import com.example.backend.entity.SalesTrendDTO;
import com.example.backend.entity.TopProductDTO;
import com.example.backend.repository.OrderRepository;
import com.example.backend.tenant.TenantContext;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
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

    private List<Order> getOrdersInRange(Instant start, Instant end) {
        List<Order> orders = orderRepository.findByOrderDateBetween(start, end);
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId != null) {
            orders = orders.stream()
                    .filter(o -> o.getTenant() != null && tenantId.equals(o.getTenant().getId()))
                    .collect(Collectors.toList());
        }
        return orders;
    }

    public List<SalesTrendDTO> getSalesTrends(Instant start, Instant end) {
        List<Order> orders = getOrdersInRange(start, end);
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
        Pageable limit = PageRequest.of(0, 5);
        // TODO: scope by tenant in JPQL query for better performance
        return orderRepository.findTopProducts(start, end, limit);
    }

    public double getAverageOrderValue(Instant start, Instant end) {
        List<Order> orders = getOrdersInRange(start, end);
        if (orders.isEmpty()) return 0;
        double total = orders.stream().mapToDouble(Order::getTotalAmount).sum();
        return total / orders.size();
    }

    public double getOnTimePercentage(Instant start, Instant end) {
        List<Order> orders = getOrdersInRange(start, end);
        if (orders.isEmpty()) return 0;
        long delivered = orders.stream().filter(o -> "Delivered".equalsIgnoreCase(o.getStatus())).count();
        return (delivered * 100.0) / orders.size();
    }

    public double getCancellationRate(Instant start, Instant end) {
        List<Order> orders = getOrdersInRange(start, end);
        if (orders.isEmpty()) return 0;
        long cancelled = orders.stream().filter(o -> "Cancelled".equalsIgnoreCase(o.getStatus())).count();
        return (cancelled * 100.0) / orders.size();
    }
}
