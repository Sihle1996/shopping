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

@Service
public class AnalyticsService {
    private final OrderRepository orderRepository;

    public AnalyticsService(OrderRepository orderRepository) {
        this.orderRepository = orderRepository;
    }

    private List<Order> getOrdersInRange(Instant start, Instant end) {
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId != null) {
            return orderRepository.findByOrderDateBetweenAndTenant_Id(start, end, tenantId);
        }
        return orderRepository.findByOrderDateBetween(start, end);
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
        UUID tenantId = TenantContext.getCurrentTenantId();
        return orderRepository.findTopProducts(start, end, tenantId, limit);
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
