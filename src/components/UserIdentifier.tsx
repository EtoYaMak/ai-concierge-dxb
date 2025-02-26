"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from "next/navigation";

interface UserIdentifierProps {
    onUserIdSet: (userId: string) => void;
}

export function UserIdentifier({ onUserIdSet }: UserIdentifierProps) {
    const router = useRouter();

    useEffect(() => {
        // Get user ID from localStorage
        const userId = localStorage.getItem("chatUserId");

        if (userId) {
            // If user ID exists, set it in the parent component
            onUserIdSet(userId);
        } else {
            // If no user ID, redirect to login page
            router.push("/login");
        }
    }, [onUserIdSet, router]);

    return null;
} 