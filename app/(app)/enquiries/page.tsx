'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function EnquiriesRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/interactions'); }, [router]);
  return null;
}
