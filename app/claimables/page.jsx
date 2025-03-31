"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSmartWill } from "@/context/SmartWillContext";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ScrollText,
  AlertCircle,
  Clock,
  Check,
  Loader2,
  FileText,
  Coins,
  User,
  ArrowLeft,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { isAddress } from "ethers";
import { DotBackground } from "@/components/animateddots";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";

import { useAccount, useConnect, useDisconnect } from "wagmi";

export default function Claimables() {
  const router = useRouter();
  const { getNormalWillsAsBeneficiary, claimNormalWill, fetchWillDetails } =
    useSmartWill();

  const { address, isConnected } = useAccount();
  const {
    connectors,
    connect,
    isLoading: connectLoading,
    error: connectError,
  } = useConnect();
  const { disconnect, isLoading: disconnectLoading } = useDisconnect();

  const [claimables, setClaimables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(null);
  const [error, setError] = useState(null);

  // Consolidated Loading State
  const isConnecting = connectLoading || disconnectLoading;
  const isLoading = loading || isConnecting;

  useEffect(() => {
    const loadClaimables = async () => {
      if (!isConnected || !address) return;

      setLoading(true);
      setError(null);
      try {
        const wills = getNormalWillsAsBeneficiary();

        if (!wills || wills.length === 0) {
          setClaimables([]);
          return;
        }

        const detailedClaimables = await Promise.all(
          wills.map(async (will) => {
            try {
              const willDetails = await fetchWillDetails(will.owner);
              if (!willDetails) return null;

              return {
                owner: will.owner,
                amount: will.amount,
                description: willDetails[5] || "No description",
                lastPingTime: willDetails[2],
                claimWaitTime: willDetails[3],
                beneficiary: willDetails[0],
              };
            } catch (err) {
              console.error(`Error fetching details for will ${will.owner}:`, err);
              return null;
            }
          }),
        );

        const validClaimables = detailedClaimables.filter((c) => c !== null);
        setClaimables(validClaimables);
      } catch (err) {
        console.error("Error loading claimables:", err);
        setError(err.message || "Failed to load claimables");
      } finally {
        setLoading(false);
      }
    };

    loadClaimables();
  }, [address, isConnected, getNormalWillsAsBeneficiary, fetchWillDetails]);

  const handleClaim = async (owner) => {
    if (!owner || !isAddress(owner)) {
      setError("Invalid owner address");
      toast({
        title: "Invalid address",
        description: "The owner address is invalid",
        variant: "destructive",
      });
      return;
    }

    try {
      setClaiming(owner);
      setError(null);
      const success = await claimNormalWill(owner);

      if (success) {
        toast({
          title: "Claim submitted",
          description: "Your claim has been submitted successfully",
          variant: "success",
        });
      }
    } catch (err) {
      console.error("Error claiming:", err);
      setError(err.message || "Failed to claim");
      toast({
        title: "Claim failed",
        description: err.message || "Failed to claim. Please try again.",
        variant: "destructive",
      });
    } finally {
      setClaiming(null);
    }
  };

  const isClaimable = (lastPingTime, claimWaitTime) => {
    const now = BigInt(Math.floor(Date.now() / 1000));
    return now >= lastPingTime + claimWaitTime;
  };

  // Fixed getTimeRemaining function to properly handle BigInt conversion
  const getTimeRemaining = (lastPingTime, claimWaitTime) => {
    const now = BigInt(Math.floor(Date.now() / 1000));
    // First calculate the end time in seconds (BigInt)
    const endTimeSeconds = lastPingTime + claimWaitTime;
    // Convert to milliseconds and then to Number for Date constructor
    const endTimeMs = Number(endTimeSeconds) * 1000;

    if (isNaN(endTimeMs)) return "Invalid Date";
    return formatDistanceToNow(new Date(endTimeMs), { addSuffix: true });
  };

  const truncateAddress = (address) => {
    return address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "";
  };

  if (!isConnected) {
    return (
      <DotBackground>
        <div className="min-h-screen flex items-center justify-center text-white">
          <Card className="w-full max-w-md bg-black/40 backdrop-blur-sm shadow-md rounded-2xl border-gray-800">
            <CardHeader className="text-center">
              <CardTitle className="text-xl font-semibold">
                Connect Wallet
              </CardTitle>
              <CardDescription className="text-gray-400">
                Please connect your wallet to view claimables
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 flex justify-center">
              {connectors.map((connector) => (
                <Button
                  key={connector.id}
                  onClick={() => connect({ connector })}
                  className="text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 font-medium py-2 px-6 rounded-full shadow-lg transition-all duration-300"
                  disabled={isConnecting}
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    `Connect with ${connector.name}`
                  )}
                </Button>
              ))}
            </CardContent>
            {connectError && (
              <Alert
                variant="destructive"
                className="bg-red-900/70 text-white border-red-700 rounded-md shadow-md"
              >
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{connectError.message}</AlertDescription>
              </Alert>
            )}
          </Card>
        </div>
      </DotBackground>
    );
  }

  return (
    <DotBackground>
      <div className="min-h-screen text-white py-6">
        <div className="container mx-auto p-4 md:p-6 max-w-4xl space-y-6">
          <Button
            onClick={() => router.push("/")}
            variant="ghost"
            className="mb-4 text-gray-300 hover:text-white hover:bg-gray-800"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>

          {(error || connectError) && (
            <Alert
              variant="destructive"
              className="bg-red-900/70 text-white border-red-700 rounded-md shadow-md"
            >
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {error || connectError?.message || "An error occurred"}
              </AlertDescription>
            </Alert>
          )}

          <Card className="bg-black/40 backdrop-blur-sm shadow-md rounded-2xl border-gray-800">
            <CardHeader className="text-center">
              <CardTitle className="text-3xl font-display bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
                Your Claimable Assets
              </CardTitle>
              <CardDescription className="text-gray-400">
                View and manage academic assets designated to you
              </CardDescription>
            </CardHeader>
          </Card>

          {isLoading ? (
            <div className="grid gap-6">
              {[1, 2].map((i) => (
                <Card
                  key={i}
                  className="bg-black/30 shadow-md rounded-lg p-4 border-gray-800"
                >
                  <div className="flex items-center justify-between">
                    <div className="space-y-3">
                      <Skeleton className="h-6 w-48 bg-gray-700" />
                      <Skeleton className="h-4 w-64 bg-gray-700" />
                      <Skeleton className="h-4 w-56 bg-gray-700" />
                    </div>
                    <div className="text-right">
                      <Skeleton className="h-6 w-24 bg-gray-700" />
                      <Skeleton className="h-4 w-16 bg-gray-700 mt-2" />
                    </div>
                  </div>
                  <div className="mt-4">
                    <Skeleton className="h-4 w-full bg-gray-700" />
                  </div>
                  <div className="mt-4">
                    <Skeleton className="h-10 w-24 bg-gray-700 rounded-md" />
                  </div>
                </Card>
              ))}
            </div>
          ) : claimables.length === 0 ? (
            <Card className="bg-black/30 border-gray-800 shadow-md rounded-lg">
              <CardContent className="p-12 text-center">
                <div className="flex flex-col items-center justify-center space-y-4">
                  <ScrollText className="h-16 w-16 text-gray-500" />
                  <h3 className="text-xl font-medium text-gray-300">
                    No Claimable Assets Found
                  </h3>
                  <p className="text-gray-400 max-w-md">
                    You don&apost have any claimable academic assets at this
                    time. When someone designates you as a beneficiary, they&aposll
                    appear here.
                  </p>
                  <Button
                    onClick={() => router.push("/create-will")}
                    className="mt-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium py-2 px-6 rounded-full"
                  >
                    Create Your Own Will
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6">
              {claimables.map((claimable, index) => {
                const canClaim = isClaimable(
                  claimable.lastPingTime,
                  claimable.claimWaitTime,
                );
                const timeLeft = getTimeRemaining(
                  claimable.lastPingTime,
                  claimable.claimWaitTime,
                );

                return (
                  <Card
                    key={`${claimable.owner}-${index}`}
                    className="bg-black/30 border-gray-800 shadow-md rounded-lg overflow-hidden transition-all duration-300 hover:shadow-lg hover:bg-black/40"
                  >
                    <div className="p-6">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-xl font-semibold">
                              {claimable.description || "Academic Legacy"}
                            </CardTitle>
                            {canClaim && (
                              <Badge className="bg-green-600 text-white">
                                Ready to Claim
                              </Badge>
                            )}
                          </div>

                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <CardDescription className="text-gray-400 flex items-center gap-2 cursor-help">
                                  <FileText className="h-4 w-4" />
                                  From: {truncateAddress(claimable.owner)}
                                </CardDescription>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{claimable.owner}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <CardDescription className="text-gray-400 flex items-center gap-2 cursor-help">
                                  <User className="h-4 w-4" />
                                  Beneficiary: {truncateAddress(
                                    claimable.beneficiary,
                                  )}
                                </CardDescription>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{claimable.beneficiary}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <div className="text-right bg-gray-800/50 p-4 rounded-lg">
                          <div className="flex items-center justify-end gap-2">
                            <Coins className="h-5 w-5 text-blue-400" />
                            <div className="font-bold text-xl bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
                              {Number.parseFloat(claimable.amount).toFixed(4)}
                            </div>
                          </div>
                          <CardDescription className="text-gray-400">
                            Linea Tokens
                          </CardDescription>
                        </div>
                      </div>

                      <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-2 bg-gray-800/30 px-4 py-2 rounded-full">
                          <Clock className="h-4 w-4 text-gray-400" />
                          <span className="text-sm">
                            {canClaim ? (
                              <span className="text-green-400 font-medium">
                                Available now!
                              </span>
                            ) : (
                              <span className="text-yellow-400 font-medium">
                                Available {timeLeft}
                              </span>
                            )}
                          </span>
                        </div>

                        <Button
                          onClick={() => handleClaim(claimable.owner)}
                          disabled={claiming === claimable.owner || !canClaim}
                          className={`${
                            canClaim
                              ? "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                              : "bg-gray-700"
                          } text-white font-medium py-2 px-6 rounded-full min-w-[120px]`}
                        >
                          {claiming === claimable.owner ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Claiming...
                            </>
                          ) : canClaim ? (
                            <>
                              <Check className="mr-2 h-4 w-4" />
                              Claim Now
                            </>
                          ) : (
                            "Not Ready"
                          )}
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </DotBackground>
  );
}