import { createContext, useContext, ReactNode } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import type { User } from "@shared/schema";
import { apiRequest, queryClient } from "./queryClient";

interface BranchSession {
  branchId: string | null;
  branchName: string | null;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loginWithGoogle: () => void;
  refetchUser: () => Promise<void>;
  isAdmin: boolean;
  isVendedor: boolean;
  branchId: string | null;
  branchName: string | null;
  isBranchLoading: boolean;
  selectBranch: (branchId: string) => Promise<void>;
  refetchBranch: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();

  const { data: user = null, isLoading, refetch } = useQuery<User | null>({
    queryKey: ["/api/auth/me"],
    retry: false,
    refetchOnWindowFocus: false,
  });

  const { data: branchSession, isLoading: isBranchLoading, refetch: refetchBranchQuery } = useQuery<BranchSession>({
    queryKey: ["/api/session/branch"],
    enabled: !!user,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const refetchUser = async () => {
    await refetch();
  };

  const refetchBranch = async () => {
    await refetchBranchQuery();
  };

  const selectBranchMutation = useMutation({
    mutationFn: async (branchId: string) => {
      return await apiRequest("POST", "/api/session/branch", { branchId });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/session/branch"] });
      await refetchBranchQuery();
    },
  });

  const selectBranch = async (branchId: string) => {
    await selectBranchMutation.mutateAsync(branchId);
  };

  const loginMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      return await apiRequest("POST", "/api/auth/login", { email, password });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      await queryClient.refetchQueries({ queryKey: ["/api/auth/me"] });
      setLocation("/");
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/session/branch"] });
      setLocation("/login");
    },
  });

  const login = async (email: string, password: string) => {
    await loginMutation.mutateAsync({ email, password });
  };

  const logout = async () => {
    await logoutMutation.mutateAsync();
  };

  const loginWithGoogle = () => {
    window.location.href = "/api/login/google";
  };

  const isAdmin = user?.role === "admin" || user?.role === "sistemas";
  const isVendedor = user?.role === "vendedor";

  return (
    <AuthContext.Provider value={{ 
      user, 
      isLoading, 
      login, 
      logout, 
      loginWithGoogle, 
      refetchUser, 
      isAdmin, 
      isVendedor,
      branchId: branchSession?.branchId || null,
      branchName: branchSession?.branchName || null,
      isBranchLoading,
      selectBranch,
      refetchBranch,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
