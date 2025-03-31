"use client"

import { createContext, useContext, useState, useEffect } from "react"

import {
  useAccount,
  useBalance,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useConnect,
  useDisconnect,
  useChainId,
  useSwitchChain,
} from "wagmi"
import { formatEther, parseEther } from "viem"
import { CONTRACT_ADDRESS } from "../utils"
import CONTRACT_ABI from "@/abi"
import { lineaSepolia } from "wagmi/chains"
import { metaMask } from "wagmi/connectors"
import { toast } from "@/hooks/use-toast"

const SmartWillContext = createContext(null)

export function SmartWillProvider({ children }) {
  const { address, isConnected } = useAccount()
  const { data: balanceData } = useBalance({
    address,
    enabled: !!address,
  })
  const { connect, connectors } = useConnect({
    connector: metaMask(),
  })
  const { disconnect } = useDisconnect()
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const { writeContract, isPending: isWritePending, data: txHash } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
  })

  // Check if we're on the correct chain
  const isCorrectChain = chainId === lineaSepolia.id

  // State to store the fetched will details
  const [willDetails, setWillDetails] = useState(null);

  // State to store error when fetching will details
  const [fetchWillDetailsError, setFetchWillDetailsError] = useState(null);

  // Owner address for which to fetch will details (can be null)
  const [willDetailsOwnerAddress, setWillDetailsOwnerAddress] = useState(null);

  // Switch to Linea Sepolia
  async function switchToEDUChain() {
    try {
      setError(null)
      const result = await switchChain({ chainId: lineaSepolia.id });

      if (result?.error) {
        console.error("Error switching chain:", result.error);
        setError("Failed to switch to Linea Sepolia. Please try again.");
        toast({
          title: "Network switch failed",
          description: "Failed to switch to Linea Sepolia network. Please try again.",
          variant: "destructive",
        });
        return false;
      }


      toast({
        title: "Network switched",
        description: "Successfully connected to Linea Sepolia network",
        variant: "success",
      })
      return true
    } catch (error) {
      console.error("Error switching to Linea Sepolia:", error)
      setError("Failed to switch to Linea Sepolia. Please try again.")
      toast({
        title: "Network switch failed",
        description: "Failed to switch to Linea Sepolia network. Please try again.",
        variant: "destructive",
      })
      return false
    }
  }

  // Connect to MetaMask
  async function connectWallet() {
    try {
     
      setLoading(true)
      setError(null)

      // First connect the wallet
      const result = await connect();
     

      if (result?.error) {
        console.error("Error connecting wallet:", result.error);
        setError(result.error.message || "Error connecting to wallet. Please try again.");
        toast({
          title: "Connection failed",
          description: result.error.message || "Error connecting to wallet. Please try again.",
          variant: "destructive",
        });
        return false;
      }

      // Then check if we need to switch chains after connecting
      if (chainId !== lineaSepolia.id) {
        await switchToEDUChain();
      }

      toast({
        title: "Wallet connected",
        description: "Your wallet has been successfully connected",
        variant: "success",
      })
      return true
    } catch (error) {
      console.error("Error connecting to wallet: ", error)
      setError(error.message || "Error connecting to wallet. Please try again.")
      toast({
        title: "Connection failed",
        description: error.message || "Error connecting to wallet. Please try again.",
        variant: "destructive",
      })
      return false
    } finally {
      setLoading(false)
    }
  }

  // Create normal will
  async function createNormalWill(beneficiary, description, amount, claimWaitTime, onHashGenerated) {
    try {
      setLoading(true)
      setError(null)

      if (!address) {
        throw new Error("Please connect your wallet first")
      }

      // Verify network before proceeding
      if (!isCorrectChain) {
        const switched = await switchToEDUChain()
        if (!switched) {
          return false // Stop if chain switch fails
        }
      }

      const contractCall = {
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "createNormalWill",
        args: [beneficiary, description, claimWaitTime],
        value: parseEther(amount.toString()),
      }


      const writeResult = await writeContract(contractCall);

      if (writeResult?.error) {
          console.error("Error creating normal will:", writeResult.error);
          setError(writeResult.error.message || "Error creating will. Please try again.");
          toast({
            title: "Will creation failed",
            description: writeResult.error.message || "Error creating will. Please try again.",
            variant: "destructive",
          });
          return false;
      }

      // Call the callback with the transaction hash when available
      if (txHash && onHashGenerated) {
        onHashGenerated(txHash)
      }

      return true
    } catch (error) {
      console.error("Error creating normal will:", error)
      setError(error.message || "Error creating will. Please try again.")
      toast({
        title: "Will creation failed",
        description: error.message || "Error creating will. Please try again.",
        variant: "destructive",
      })
      return false
    } finally {
      setLoading(false)
    }
  }

  // Get normal will by owner address
  const { data: normalWillData, refetch: refetchNormalWill } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: "normalWills",
    args: [address],
    enabled: !!address && isConnected,
  })


  // Check if address has created a will
  const { data: hasWill, refetch: refetchHasWill } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: "hasNormalWill",
    args: [address],
    enabled: !!address && isConnected,
  })

  // Ping the contract to show activity
  async function ping() {
    try {
      setLoading(true)
      setError(null)

      if (!address) {
        throw new Error("Please connect your wallet first")
      }

      // Verify network before proceeding
      if (!isCorrectChain) {
        const switched = await switchToEDUChain()
        if (!switched) {
          return false; // Stop if chain switch fails
        }
      }

      const contractCall = {
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "ping",
      }

      const writeResult = await writeContract(contractCall);

      if (writeResult?.error) {
          console.error("Error pinging contract:", writeResult.error);
          setError("Error updating activity status. Please try again.");
          toast({
            title: "Activity update failed",
            description: "Error updating activity status. Please try again.",
            variant: "destructive",
          });
          return false;
      }

      toast({
        title: "Activity updated",
        description: "Your activity status has been updated successfully",
        variant: "success",
      })
      return true
    } catch (error) {
      console.error("Error pinging contract:", error)
      setError("Error updating activity status. Please try again.")
      toast({
        title: "Activity update failed",
        description: "Error updating activity status. Please try again.",
        variant: "destructive",
      })
      return false
    } finally {
      setLoading(false)
    }
  }

  // Deposit more to existing will
  async function depositNormalWill(amount) {
    try {
      setLoading(true)
      setError(null)

      if (!address) {
        throw new Error("Please connect your wallet first")
      }

      // Verify network before proceeding
      if (!isCorrectChain) {
        const switched = await switchToEDUChain()
        if (!switched) {
          return false
        }
      }

      const contractCall = {
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "deposit",
        value: parseEther(amount.toString()),
      }

      const writeResult = await writeContract(contractCall);

      if (writeResult?.error) {
          console.error("Error depositing to will:", writeResult.error);
          setError("Error making deposit. Please try again.");
          toast({
            title: "Deposit failed",
            description: "Error making deposit. Please try again.",
            variant: "destructive",
          });
          return false;
      }


      toast({
        title: "Deposit initiated",
        description: `Depositing ${amount} Linea to your will`,
        variant: "success",
      })
      return true
    } catch (error) {
      console.error("Error depositing to will:", error)
      setError("Error making deposit. Please try again.")
      toast({
        title: "Deposit failed",
        description: "Error making deposit. Please try again.",
        variant: "destructive",
      })
      return false
    } finally {
      setLoading(false)
    }
  }

  // Get wills where the connected account is a beneficiary
  const { data: beneficiaryWills, refetch: refetchBeneficiaryWills } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: "getNormalWillAsBeneficiary",
    args: [address],
    enabled: !!address && isConnected,
  })

  

  // Format beneficiary wills data
  const formattedBeneficiaryWills = beneficiaryWills
    ? beneficiaryWills[0].map((owner, index) => ({
      owner,
      amount: formatEther(beneficiaryWills[1][index]),
    }))
    : []

  

  // Get milestone wills where the connected account is a beneficiary
  const { data: milestoneBeneficiaryWills, refetch: refetchMilestoneBeneficiaryWills } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: "getMilestoneWillsAsBeneficiary",
    args: [address],
    enabled: !!address && isConnected,
  })

  // Format milestone beneficiary wills data
  const formattedMilestoneBeneficiaryWills = milestoneBeneficiaryWills
    ? milestoneBeneficiaryWills[0].map((owner, index) => ({
      owner,
      willIndex: milestoneBeneficiaryWills[1][index],
      releaseIndex: milestoneBeneficiaryWills[2][index],
      amount: formatEther(milestoneBeneficiaryWills[3][index]),
    }))
    : []

  // Claim a normal will as a beneficiary
  async function claimNormalWill(ownerAddress) {
    try {
      setLoading(true)
      setError(null)

      if (!address) {
        throw new Error("Please connect your wallet first")
      }

      // Verify network before proceeding
      if (!isCorrectChain) {
        const switched = await switchToEDUChain()
        if (!switched) {
          return false
        }
      }

      const contractCall = {
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "claimNormalWill",
        args: [ownerAddress],
      }
      const writeResult = await writeContract(contractCall);

      if (writeResult?.error) {
          console.error("Error claiming will:", writeResult.error);
          setError(writeResult.error.message || "Error claiming will. Please try again.");
          toast({
            title: "Claim failed",
            description: writeResult.error.message || "Error claiming will. Please try again.",
            variant: "destructive",
          });
          return false;
      }


      toast({
        title: "Claim initiated",
        description: "Your claim request has been submitted",
        variant: "success",
      })
      return true
    } catch (error) {
      console.error("Error claiming will:", error)
      setError(error.message || "Error claiming will. Please try again.")
      toast({
        title: "Claim failed",
        description: error.message || "Error claiming will. Please try again.",
        variant: "destructive",
      })
      return false
    } finally {
      setLoading(false)
    }
  }

  // Claim a milestone will as a beneficiary
  async function claimMilestoneWill(ownerAddress, willIndex, releaseIndex) {
    try {
      setLoading(true)
      setError(null)

      if (!address) {
        throw new Error("Please connect your wallet first")
      }

      // Verify network before proceeding
      if (!isCorrectChain) {
        const switched = await switchToEDUChain()
        if (!switched) {
          return false
        }
      }

      const contractCall = {
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "claimMilestoneWill",
        args: [ownerAddress, willIndex, releaseIndex],
      }
      const writeResult = await writeContract(contractCall);

      if (writeResult?.error) {
          console.error("Error claiming milestone will:", writeResult.error);
          setError(writeResult.error.message || "Error claiming milestone will. Please try again.");
          toast({
            title: "Milestone claim failed",
            description: writeResult.error.message || "Error claiming milestone will. Please try again.",
            variant: "destructive",
          });
          return false;
      }


      toast({
        title: "Milestone claim initiated",
        description: "Your milestone claim request has been submitted",
        variant: "success",
      })
      return true
    } catch (error) {
      console.error("Error claiming milestone will:", error)
      setError(error.message || "Error claiming milestone will. Please try again.")
      toast({
        title: "Milestone claim failed",
        description: error.message || "Error claiming milestone will. Please try again.",
        variant: "destructive",
      })
      return false
    } finally {
      setLoading(false)
    }
  }

  // useReadContract hook to fetch will details, disabled initially
  const {
    data: normalWill,
    refetch: refetchNormalWillDetails,
    isLoading: isFetchingWillDetails,
    error: readContractError
  } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: "normalWills",
    args: willDetailsOwnerAddress ? [willDetailsOwnerAddress] : undefined, // Use undefined when address is null
    enabled: !!willDetailsOwnerAddress && isConnected, // Only enable when address is set AND connected
    onSuccess: (data) => {
        setWillDetails(data);
        setFetchWillDetailsError(null); // Clear any previous errors
    },
    onError: (error) => {
        console.error("Error fetching will details:", error);
        setFetchWillDetailsError(error.message || "Error fetching will details. Please try again.");
        setWillDetails(null); // Clear any previous will details
    }
  });

  // Modified fetchWillDetails function - it only sets the owner address and triggers refetch
  const fetchWillDetails = async (ownerAddress) => {
      try {
          setLoading(true); // Still use loading state as this can take time
          setError(null);
          setFetchWillDetailsError(null);

          if (!address) {
              throw new Error("Please connect your wallet first");
          }

          // Verify network before proceeding
          if (!isCorrectChain) {
              const switched = await switchToEDUChain();
              if (!switched) {
                  setLoading(false);
                  return null;
              }
          }

          setWillDetailsOwnerAddress(ownerAddress); // Set the owner address
          await refetchNormalWillDetails(); // Trigger the refetch
          
          return normalWill

      } catch (error) {
          console.error("Error setting will owner:", error);
          setFetchWillDetailsError(error.message || "Error fetching will details. Please try again.");
          return null;
      } finally {
          setLoading(false);
      }
  };


  // Refresh data after transactions
  useEffect(() => {
    if (isConfirmed && address) {
      refetchNormalWill()
      refetchHasWill()
      refetchBeneficiaryWills()
      refetchMilestoneBeneficiaryWills()

      toast({
        title: "Transaction confirmed",
        description: "Your transaction has been confirmed on the blockchain",
        variant: "success",
      })
    }
  }, [isConfirmed, address, refetchNormalWill, refetchHasWill, refetchBeneficiaryWills, refetchMilestoneBeneficiaryWills])

  const value = {
    account: address,
    balance: balanceData ? formatEther(balanceData.value) : "0",
    isConnected,
    loading: loading || isWritePending || isConfirming,
    error,
    connectors,
    chainId: chainId?.toString(),
    connectWallet,
    disconnect,
    createNormalWill,
    getNormalWill: () => normalWillData,
    hasCreatedWill: () => hasWill,
    ping,
    depositNormalWill,
    switchToEDUChain,
    getNormalWillsAsBeneficiary: () => formattedBeneficiaryWills,
    getMilestoneWillsAsBeneficiary: () => formattedMilestoneBeneficiaryWills,
    claimNormalWill,
    claimMilestoneWill,
    isTransactionPending: isWritePending,
    isTransactionConfirming: isConfirming,
    isTransactionConfirmed: isConfirmed,
    transactionHash: txHash,

    fetchWillDetails,
    willDetails: normalWill, // Expose the fetched will details
    isFetchingWillDetails, // Expose the loading state
    fetchWillDetailsError // Expose the fetch error
  }

  return <SmartWillContext.Provider value={value}>{children}</SmartWillContext.Provider>
}

export function useSmartWill() {
  const context = useContext(SmartWillContext)
  if (!context) {
    throw new Error("useSmartWill must be used within a SmartWillProvider")
  }
  return context
}