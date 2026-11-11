package com.curalithra.web.repository;

import com.curalithra.web.entity.BillEntity;
import com.curalithra.web.enums.PaymentStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

public interface BillRepository extends JpaRepository<BillEntity, Long> {

    @EntityGraph(attributePaths = {"patient", "appointment"})
    Optional<BillEntity> findHydratedById(Long id);

    @EntityGraph(attributePaths = {"patient", "appointment"})
    @Query("""
            SELECT b FROM BillEntity b
            WHERE b.demoRecord = :isDemo
              AND (:q = '' OR LOWER(b.invoiceNumber) LIKE LOWER(CONCAT('%', :q, '%'))
                   OR LOWER(b.patient.fullName) LIKE LOWER(CONCAT('%', :q, '%'))
                   OR LOWER(b.patient.patientCode) LIKE LOWER(CONCAT('%', :q, '%')))
              AND (:hasStatus = false OR b.paymentStatus = :status)
              AND (:patientId = 0L OR b.patient.id = :patientId)
              AND b.issuedAt >= :fromTs
              AND b.issuedAt <= :toTs
            """)
    Page<BillEntity> searchAndFilter(
            @Param("q") String query,
            @Param("hasStatus") boolean hasStatus,
            @Param("status") PaymentStatus status,
            @Param("patientId") long patientId,
            @Param("fromTs") OffsetDateTime fromTs,
            @Param("toTs") OffsetDateTime toTs,
            @Param("isDemo") boolean isDemo,
            Pageable pageable);

    @Query("SELECT COALESCE(SUM(b.totalAmount), 0) FROM BillEntity b WHERE b.demoRecord = :isDemo AND b.paymentStatus <> 'CANCELLED'")
    BigDecimal sumTotalBilledRevenue(@Param("isDemo") boolean isDemo);

    @Query("SELECT COALESCE(SUM(b.paidAmount), 0) FROM BillEntity b WHERE b.demoRecord = :isDemo AND b.paymentStatus <> 'CANCELLED'")
    BigDecimal sumCollectedRevenue(@Param("isDemo") boolean isDemo);

    @Query("SELECT COUNT(b) FROM BillEntity b WHERE b.demoRecord = :isDemo AND b.paymentStatus IN ('PENDING', 'PARTIALLY_PAID')")
    long countOpenInvoices(@Param("isDemo") boolean isDemo);

    @Query(value = """
            SELECT TO_CHAR(issued_at AT TIME ZONE :timezone, 'YYYY-MM') AS ym, COALESCE(SUM(total_amount), 0) AS total
            FROM bills
            WHERE is_demo = :isDemo
              AND payment_status <> 'CANCELLED'
            GROUP BY ym
            ORDER BY ym DESC
            LIMIT :limit
            """, nativeQuery = true)
    List<Object[]> sumMonthlyRevenue(
            @Param("isDemo") boolean isDemo,
            @Param("limit") int limit,
            @Param("timezone") String timezone);
}
