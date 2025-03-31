"use client";


import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useSmartWill } from "@/context/SmartWillContext";
import {
  Loader2,
  PlusCircle,
  Clock,
  Wallet,
  AlertCircle,
  User,
  FileText,
  Calendar,
  Coins,
  Shield,
  History,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { motion, AnimatePresence } from "framer-motion";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DotBackground } from "@/components/animateddots";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { toast } from "@/hooks/use-toast";





const CheckMyWill = () => {
  const [willDetails, setWillDetails] = useState(null);
const [loading, setLoading] = useState(false);
const [error, setError] = useState(null);
const [depositAmount, setDepositAmount] = useState("");
const [timeRemaining, setTimeRemaining] = useState("--");
const [timeProgress, setTimeProgress] = useState(0);
  const [isDepositing, setIsDepositing] = useState(false);
  const [isPinging, setIsPinging] = useState(false);
  const [lastPingTimeAgo, setLastPingTimeAgo] = useState("--");
  const [withdrawalAvailable, setWithdrawalAvailable] = useState(false);
  const [canBeneficiaryClaim, setCanBeneficiaryClaim] = useState(false);

  const {
    ping,
    depositNormalWill,
    withdrawNormalWill,
    hasCreatedWill,
    fetchWillDetails,
    willDetails: willDetailsFromContext,
    isFetchingWillDetails,
    fetchWillDetailsError,
  } = useSmartWill();
  const router = useRouter();

  const { address, isConnected } = useAccount();
  const {
    connectors,
    connect,
    isLoading: connectLoading,
    error: connectError,
  } = useConnect();
  const { disconnect } = useDisconnect();

  // Safely check withdrawal eligibility with proper type handling
  const checkWithdrawalEligibility = useCallback(
    (creationTime) => {
      try {
        if (creationTime === undefined) {
          console.warn(
            "creationTime is undefined. Skipping eligibility check.",
          );
          setWithdrawalAvailable(false);
          return;
        }
        const oneYear = BigInt(365) * BigInt(24) * BigInt(60) * BigInt(60);
        const now = BigInt(Math.floor(Date.now() / 1000));
        const eligibilityTime = creationTime + oneYear;
        setWithdrawalAvailable(now >= eligibilityTime);
      } catch (err) {
        console.error("Error checking withdrawal eligibility:", err);
        setWithdrawalAvailable(false);
      }
    },
    [],
  );

  // Update will details when context data changes
  useEffect(() => {
    if (willDetailsFromContext) {
      setWillDetails(willDetailsFromContext);
      checkWithdrawalEligibility(willDetailsFromContext.creationTime);
    } else {
      setWithdrawalAvailable(false);
    }
  }, [willDetailsFromContext, checkWithdrawalEligibility]);

  // Fetch will details from the blockchain
  const getWillDetails = useCallback(async () => {
    if (!address || !isConnected) return;

    setLoading(true);
    setError(null);
    try {
      await fetchWillDetails(address);
    } catch (err) {
      console.error("Error fetching will details:", err);
      setError("Unable to fetch will details. Please try again.");
      toast({
        title: "Error fetching will details",
        description: "Please refresh the page",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [address, isConnected, fetchWillDetails]);

  // Check if user has a will and fetch details
  useEffect(() => {
    let mounted = true;

    async function checkAndFetchWill() {
      if (!isConnected || !address) return;

      try {
        setLoading(true);
        const hasWill = await hasCreatedWill(address);
        if (!mounted) return;

        if (!hasWill) {
          router.push("/create-will/simple");
          toast({
            title: "No will found",
            description: "Redirecting to create a new will",
            variant: "info",
          });
        } else {
          await getWillDetails();
        }
      } catch (err) {
        if (!mounted) return;
        console.error("Error checking will status:", err);
        setError("Error checking will status. Please try again.");
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    checkAndFetchWill();

    return () => {
      mounted = false;
    };
  }, [address, hasCreatedWill, router, isConnected, getWillDetails]);

  // Update countdown timer
  useEffect(() => {
    if (!willDetails) return;

    let mounted = true;
    let intervalId;

    const updateCounter = () => {
      if (!mounted || !willDetails) return;

      try {
        const now = BigInt(Math.floor(Date.now() / 1000));

        // Safely access properties with null checks
        const lastPingTime = willDetails[2];
        const claimWaitTime = willDetails[3];

        if (lastPingTime === undefined || claimWaitTime === undefined) {
          console.warn("Missing time values in will details");
          return;
        }

        const remainingTime = lastPingTime + claimWaitTime - now;

        // Convert to Number only for display calculations - safely
        const remainingTimeNumber = Number(remainingTime);
        const totalTimeNumber = Number(claimWaitTime);

        // Calculate progress percentage
        const elapsed = totalTimeNumber - remainingTimeNumber;
        const progress = Math.min(
          100,
          Math.max(0, (elapsed / totalTimeNumber) * 100),
        );
        setTimeProgress(progress);

        // Calculate time since last ping
        const timeSinceLastPing = now - lastPingTime;
        const daysAgo = Number(timeSinceLastPing / BigInt(24 * 60 * 60));

        if (!mounted) return;

        setLastPingTimeAgo(
          daysAgo === 0
            ? "Today"
            : daysAgo === 1
              ? "Yesterday"
              : `${daysAgo} days ago`,
        );

        if (remainingTime <= BigInt(0)) {
          setTimeRemaining("Beneficiary can claim");
          setCanBeneficiaryClaim(true);
        } else {
          setCanBeneficiaryClaim(false);
          const days = Number(remainingTime / BigInt(24 * 60 * 60));
          const hours = Number(
            (remainingTime % BigInt(24 * 60 * 60)) / BigInt(60 * 60),
          );
          const minutes = Number((remainingTime % BigInt(60 * 60)) / BigInt(60));
          const seconds = Number(remainingTime % BigInt(60));
          setTimeRemaining(`${days}d ${hours}h ${minutes}m ${seconds}s`);
        }
      } catch (err) {
        console.error("Error updating counter:", err);
        // Set fallback values on error
        setTimeRemaining("--");
        setTimeProgress(0);
        setCanBeneficiaryClaim(false);
      }
    };

    // Initialize and update every second
    updateCounter();
    intervalId = setInterval(updateCounter, 1000);

    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, [willDetails]);

  // Handle deposit
  const handleDeposit = async (e) => {
    e.preventDefault();
    if (!depositAmount || Number.parseFloat(depositAmount) <= 0) {
      setError("Please enter a valid amount to deposit.");
      toast({
        title: "Invalid amount",
        description: "Please enter a valid amount to deposit",
        variant: "destructive",
      });
      return;
    }

    setIsDepositing(true);
    setError(null);
    try {
      await depositNormalWill(depositAmount);
      toast({
        title: "Deposit successful",
        description: `Successfully deposited ${depositAmount} Linea`,
        variant: "success",
      });
      await getWillDetails(); // Refresh details
    } catch (err) {
      console.error("Deposit error:", err);
      setError("Failed to deposit funds. Please try again.");
      toast({
        title: "Deposit failed",
        description: err.message || "Failed to deposit funds. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDepositing(false);
      setDepositAmount("");
    }
  };

  // Handle ping
  const handlePing = async () => {
    setIsPinging(true);
    setError(null);
    try {
      await ping();
      toast({
        title: "Activity confirmed",
        description: "Your activity has been confirmed on the blockchain",
        variant: "success",
      });
      await getWillDetails(); // Refresh details
    } catch (err) {
      console.error("Ping error:", err);
      setError("Failed to confirm activity. Please try again.");
      toast({
        title: "Activity confirmation failed",
        description: err.message || "Failed to confirm activity. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsPinging(false);
    }
  };

  // Handle withdraw
  const handleWithdraw = async () => {
    if (!willDetails) return;
    setLoading(true); // Indicate loading state during withdrawal
    try {
      // Convert BigInt to string for the withdrawNormalWill function
      const amountInEther = formatEther(willDetails[1]);
      await withdrawNormalWill(amountInEther);
      toast({
        title: "Withdrawal successful",
        description: `Successfully withdrew ${amountInEther} Linea`,
        variant: "success",
      });
      await getWillDetails(); // Refresh details
    } catch (err) {
      console.error("Withdraw error:", err);
      setError("Failed to withdraw funds. Please try again.");
      toast({
        title: "Withdrawal failed",
        description: err.message || "Failed to withdraw funds. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false); // Clear loading state after attempt
    }
  };

  // Helper function to safely format BigInt to Ether string
  const formatEther = (value) => {
    try {
      return (Number(value) / 1e18).toFixed(6);
    } catch (err) {
      console.error("Error formatting ether value:", err);
      return "0.0";
    }
  };

  // Get status info with proper null checks
  const getStatusInfo = () => {
    if (!willDetails) return { color: "text-gray-500", text: "Unknown" };

    try {
      if (willDetails.isClaimed) return { color: "text-red-500", text: "Claimed" };

      const now = BigInt(Math.floor(Date.now() / 1000));
      const remainingTime = willDetails[2] + willDetails[3] - now;

      if (remainingTime <= BigInt(0)) return { color: "text-red-500", text: "Claimable" };
      if (remainingTime <= willDetails[3] / BigInt(10))
        return { color: "text-yellow-500", text: "Action Needed" };
      return { color: "text-green-500", text: "Active" };
    } catch (err) {
      console.error("Error calculating status:", err);
      return { color: "text-gray-500", text: "Unknown" };
    }
  };

  // Show connect wallet UI if not connected
  if (!isConnected) {
    return (
      <DotBackground>
        <div className="flex items-center justify-center bg-transparent min-h-screen">
          <Card className="w-full flex flex-col justify-center items-center max-w-md bg-transparent backdrop-blur-sm text-center p-6 pb-9">
            <CardHeader>
              <CardTitle>Connect Wallet</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="pb-7">Please connect your wallet to view your will details.</p>
              {connectors.map((connector) => (
                <Button
                  key={connector.id}
                  onClick={() => connect({ connector })}
                  className="text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 font-medium py-2 px-6 rounded-full shadow-lg transition-all duration-300"
                  disabled={connectLoading}
                >
                  {connectLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    `Connect with ${connector.name}`
                  )}
                </Button>
              ))}
              {connectError && (
                <Alert variant="destructive" className="mt-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{connectError.message}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </div>
      </DotBackground>
    );
  }

  // Show error if there's a fetch error
  if (fetchWillDetailsError) {
    return (
      <Alert variant="destructive" className="max-w-2xl mx-auto mt-8">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{fetchWillDetailsError}</AlertDescription>
      </Alert>
    );
  }

  // Show loading state
  if (loading || isFetchingWillDetails) {
    return (
      <DotBackground>
        <div className="flex flex-col items-center justify-center bg-transparent min-h-screen p-4">
          <Card className="w-full max-w-md bg-transparent backdrop-blur-sm text-center">
            <CardHeader>
              <CardTitle>Loading Will Details...</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-6">Fetching your will data. Please wait...</p>
              <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
            </CardContent>
          </Card>
        </div>
      </DotBackground>
    );
  }

  // Show "No Will Found" if no will details
  if (!willDetails) {
    return (
      <DotBackground>
        <div className="flex flex-col items-center justify-center bg-transparent min-h-screen p-4">
          <Card className="w-full max-w-md bg-transparent backdrop-blur-sm text-center">
            <CardHeader>
              <CardTitle>No Will Found</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-6">It appears you have not created a digital will yet.</p>
              <Button
                onClick={() => router.push("/create-will/simple")}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                <PlusCircle className="w-4 h-4 mr-2" />
                Create Will
              </Button>
            </CardContent>
          </Card>
        </div>
      </DotBackground>
    );
  }

  const status = getStatusInfo();

  // Main UI with will details
  return (
    <DotBackground>
      <div className="min-h-screen flex items-center justify-center px-4 py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key="will-details"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-4xl"
          >
            <Card className="overflow-hidden bg-transparent backdrop-blur-sm">
              <CardHeader className="bg-transparent">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-3xl font-semibold">
                    Digital Will Dashboard
                  </CardTitle>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <div className={`flex items-center gap-2 ${status.color}`}>
                          <Shield className="w-6 h-6" />
                          <span className="text-sm font-semibold">{status.text}</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Last activity: {lastPingTimeAgo}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-8">
                <div className="grid md:grid-cols-2 gap-6">
                  <InfoCard icon={User} title="Beneficiary" content={willDetails[0]} />
                  <InfoCard
                    icon={Coins}
                    title="Amount Secured"
                    content={`${formatEther(willDetails[1])} Linea`}
                  />
                  <InfoCard
                    icon={Calendar}
                    title="Created On"
                    content={new Date(Number(willDetails[4]) * 1000).toLocaleDateString(
                      undefined,
                      {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      },
                    )}
                  />
                  <InfoCard
                    icon={History}
                    title="Last Activity"
                    content={`${lastPingTimeAgo} (${new Date(
                      Number(willDetails[2]) * 1000,
                    ).toLocaleString()})`}
                  />
                </div>

                <div className="space-y-2">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    Time Until Claim
                  </h3>
                  <div className="bg-secondary p-4 rounded-lg">
                    <p className="text-4xl font-mono mb-2">{timeRemaining}</p>
                    <Progress value={timeProgress} className="h-2" />
                  </div>
                </div>

                <div className="bg-secondary rounded-lg p-4">
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Will Description
                  </h3>
                  <p className="text-sm">{willDetails[5]}</p>
                </div>

                {!canBeneficiaryClaim && !willDetails.isClaimed && (
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-4">
                      <form onSubmit={handleDeposit} className="space-y-2">
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            step="0.000000000000000001"
                            min="0"
                            placeholder="Amount in Linea"
                            value={depositAmount}
                            onChange={(e) => setDepositAmount(e.target.value)}
                            className="flex-grow"
                          />
                          <Button
                            type="submit"
                            disabled={
                              isDepositing ||
                              !depositAmount ||
                              Number.parseFloat(depositAmount) <= 0
                            }
                            className="whitespace-nowrap bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                          >
                            {isDepositing ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <Wallet className="w-4 h-4 mr-2" />
                                Add Funds
                              </>
                            )}
                          </Button>
                        </div>
                      </form>
                      {withdrawalAvailable && (
                        <Button
                          onClick={handleWithdraw}
                          variant="outline"
                          disabled={loading} // Disable during withdrawal
                          className="w-full hover:bg-red-100 dark:hover:bg-red-900"
                        >
                          {loading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            "Withdraw Funds"
                          )}
                        </Button>
                      )}
                    </div>
                    <Button
                      onClick={handlePing}
                      disabled={isPinging}
                      variant="secondary"
                      className="w-full h-full bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white"
                    >
                      {isPinging ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Clock className="w-4 h-4 mr-2" />
                          Confirm Activity
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {canBeneficiaryClaim && (
                  <Alert variant="destructive" className="mt-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      The beneficiary can now claim this will. You cannot add funds or confirm
                      activity at this time.
                    </AlertDescription>
                  </Alert>
                )}

                {willDetails.isClaimed && (
                  <Alert variant="destructive" className="mt-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>This will has been claimed by the beneficiary.</AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </AnimatePresence>
      </div>
    </DotBackground>
  );
};

const InfoCard = ({
  icon: Icon,
  title,
  content,
  highlight = false,
  className = "",
}) => (
  <div className={`p-4 rounded-lg ${highlight ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
    <h3 className="font-semibold mb-2 flex items-center gap-2">
      <Icon className="w-5 h-5" />
      {title}
    </h3>
    <p className={`${highlight ? "text-4xl font-mono" : "text-sm"} break-all ${className}`}>{content}</p>
  </div>
);

export default CheckMyWill;