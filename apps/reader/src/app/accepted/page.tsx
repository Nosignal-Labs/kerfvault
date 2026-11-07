"use client";

import React, { useState, useEffect, useCallback } from "react";
import { VoucherQueueList } from "../../components/VoucherQueueList";
import { getAllStoredVouchers, type StoredVoucherRecord } from "../../lib/storage";
import { getMerchantSettings } from "../../lib/merchantSettings";

export default function AcceptedVouchersPage() {
  const [vouchers, setVouchers] = useState<StoredVoucherRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [maxExposure, setMaxExposure] = useState<number>(500);

  const loadVouchers = useCallback(async () => {
    setIsLoading(true);
    try {
      const records = await getAllStoredVouchers();
      // Sort newest first
      records.sort((a, b) => b.receivedAt - a.receivedAt);
      setVouchers(records);

      const settings = getMerchantSettings();
      setMaxExposure(settings.maxTotalOfflineExposureXlm);
    } catch (err) {
      console.error("Failed to load vouchers from IndexedDB:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVouchers();
  }, [loadVouchers]);

  return (
    <div className="space-y-6">
      <VoucherQueueList
        vouchers={vouchers}
        isLoading={isLoading}
        onRefresh={loadVouchers}
        maxTotalExposureXlm={maxExposure}
      />
    </div>
  );
}
