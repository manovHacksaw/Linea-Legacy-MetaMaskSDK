"use client"

import { useEffect, useState, useCallback } from "react"
import { isAddress } from "ethers"
import { useSmartWill } from "@/context/SmartWillContext"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { ScrollText, AlertCircle, Info, Clock, GraduationCap, BookOpen, Loader2, Wallet, ArrowLeft } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { useRouter } from "next/navigation"
import { AnimatedShinyText } from "./magicui/animated-shiny-text"
import { DotBackground } from "./animateddots"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "@/hooks/use-toast"
import { Separator } from "@/components/ui/separator"

export default function CreateSimpleWill() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    beneficiary: "",
    assets: "",
    amount: "",
    claimWaitTime: "60",
  })
  const [validationError, setValidationError] = useState("")
  const [openDialog, setOpenDialog] = useState(false)
  const [checkingWill, setCheckingWill] = useState(true)
  const [hasWill, setHasWill] = useState(false)
  const [activeTab, setActiveTab] = useState("details")

  // Transaction states
  const [transactionHash, setTransactionHash] = useState("")
  const [creatingWill, setCreatingWill] = useState(false)
  const [waitingForSignature, setWaitingForSignature] = useState(false)

  const [confirmationChecks, setConfirmationChecks] = useState({
    termsAccepted: false,
    understandInactivity: false,
    understandFees: false,
    confirmBeneficiary: false,
    createBackup: false,
    allowDistribution: false,
    understandLock: false,
    acceptRisks: false,
  })

  const { account, balance, connectWallet, createNormalWill, loading, error, isConnected, hasCreatedWill, chainId } =
    useSmartWill()

  useEffect(() => {
    if (!isConnected) {
      connectWallet()
    }
  }, [isConnected])

  // Check Will Status Effect - Moved to useCallback for correct memoization
  const checkWillStatus = useCallback(async () => {
    if (account && isConnected) {
      setCheckingWill(true)
      try {
        const willExists = await hasCreatedWill(account)
        setHasWill(willExists)
        if (willExists) {
          router.push("/check-my-will/simple")
          toast({
            title: "Existing will found",
            description: "Redirecting to your will management page",
            variant: "info",
          })
        }
      } catch (error) {
        console.error("Error checking will status:", error)
        toast({
          title: "Error checking will status",
          description: "Failed to check if you have an existing will",
          variant: "destructive",
        })
      } finally {
        setCheckingWill(false)
      }
    } else {
      setCheckingWill(false)
    }
  }, [account, isConnected, router, hasCreatedWill])

  useEffect(() => {
    checkWillStatus() // Call the memoized function
  }, [checkWillStatus])

  // Handle Submit Effect
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!isConnected) {
      await connectWallet()
      return
    }
    if (!validateForm()) return

    try {
      setCreatingWill(true)
      setWaitingForSignature(true)
      setTransactionHash("") // Reset transaction hash before starting

      // Add balance check
      const requiredAmount = Number(formData.amount)
      if (Number(balance) < requiredAmount) {
        throw new Error(
          `Insufficient balance. You need ${requiredAmount} Linea but have ${Number(balance).toFixed(4)} Linea`,
        )
      }

      const success = await createNormalWill(
        formData.beneficiary,
        formData.assets,
        formData.amount,
        formData.claimWaitTime,
        (hash) => {
          setTransactionHash(hash)
          setWaitingForSignature(false)
          toast({
            title: "Transaction submitted",
            description: "Your will creation transaction has been submitted to the blockchain",
            variant: "success",
          })
        },
      )

      if (success) {
        setFormData({ beneficiary: "", assets: "", amount: "", claimWaitTime: "60" })
        setOpenDialog(false)
        setConfirmationChecks(Object.keys(confirmationChecks).reduce((acc, key) => ({ ...acc, [key]: false }), {}))
        toast({
          title: "Will created successfully",
          description: "Your academic legacy has been secured on the blockchain",
          variant: "success",
        })
      }
    } catch (err) {
      console.error("Error submitting will:", err)
      setValidationError(err.message || "Failed to create will. Please try again.")
      toast({
        title: "Will creation failed",
        description: err.message || "Failed to create will. Please try again.",
        variant: "destructive",
      })
    } finally {
      setCreatingWill(false)
      setWaitingForSignature(false)
    }
  }

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
    setValidationError("")
  }

  const handleCheckboxChange = (name) => {
    setConfirmationChecks((prev) => ({ ...prev, [name]: !prev[name] }))
  }

  const getConfirmationLabel = (key) => {
    const labels = {
      termsAccepted: "Accept Terms and Conditions",
      understandInactivity: "Understand Inactivity Period",
      understandFees: "Acknowledge Service Fee",
      confirmBeneficiary: "Confirm Beneficiary",
      createBackup: "Create Backup",
      allowDistribution: "Allow Distribution",
      understandLock: "Understand Asset Lock",
      acceptRisks: "Accept Risks",
    }
    return labels[key] || key
  }

  const getConfirmationDescription = (key) => {
    const descriptions = {
      termsAccepted: "I accept the terms and conditions of the Educational Smart Will service",
      understandInactivity: "My academic beneficiary can only claim after the specified inactivity period",
      understandFees: "A 2% service fee in Linea tokens will support the Linea Legacy ecosystem",
      confirmBeneficiary: "The beneficiary address belongs to my chosen academic successor",
      createBackup: "I have securely backed up my wallet credentials and academic documentation",
      allowDistribution: "If unclaimed, I allow distribution to the Linea Legacy scholarship fund",
      understandLock: "Academic assets will be locked for minimum 1 year after creation",
      acceptRisks: "I understand and accept all risks associated with blockchain-based academic asset transfer",
    }
    return descriptions[key] || ""
  }

  const ConfirmationCheckboxes = () => {
    const checkedCount = Object.values(confirmationChecks).filter(Boolean).length
    const totalChecks = Object.keys(confirmationChecks).length
    const progressPercentage = (checkedCount / totalChecks) * 100

    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Confirmation Progress</span>
            <span className="font-medium">
              {checkedCount}/{totalChecks}
            </span>
          </div>
          <Progress value={progressPercentage} className="h-2" />
        </div>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
          {Object.entries(confirmationChecks).map(([key, value]) => (
            <div
              key={key}
              className="flex items-start space-x-3 p-4 rounded-lg bg-gray-800/50 hover:bg-gray-800/70 transition-colors border border-gray-700"
            >
              <Checkbox
                id={key}
                checked={value}
                onCheckedChange={() => handleCheckboxChange(key)}
                className="mt-1 border-gray-500"
              />
              <div className="space-y-1">
                <Label htmlFor={key} className="text-sm font-medium leading-none cursor-pointer text-gray-200">
                  {getConfirmationLabel(key)}
                </Label>
                <p className="text-xs text-gray-400">{getConfirmationDescription(key)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (creatingWill) {
    return (
      <DotBackground>
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <Card className="w-full max-w-md bg-black/70 border-gray-800">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center space-y-6">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="h-16 w-16 rounded-full bg-blue-500/20"></div>
                  </div>
                  <Loader2 className="h-12 w-12 animate-spin text-blue-400 relative z-10" />
                </div>

                <div className="text-center space-y-2">
                  <h3 className="text-xl font-semibold text-white">
                    {waitingForSignature ? "Please Confirm Transaction" : "Creating Your Academic Will"}
                  </h3>

                  <p className="text-gray-400">
                    {waitingForSignature ? (
                      <>
                        Please accept the MetaMask request and confirm the transaction
                        <br />
                        <span className="font-medium text-blue-400">Amount to deposit: {formData.amount} Linea</span>
                      </>
                    ) : (
                      "Waiting for the transaction to be mined..."
                    )}
                  </p>
                </div>

                {transactionHash && (
                  <div className="w-full space-y-2">
                    <p className="text-sm text-gray-400 text-center">Transaction Hash:</p>
                    <a
                      href={`${process.env.NEXT_PUBLIC_BLOCK_EXPLORER_URL}/tx/${transactionHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-400 hover:text-blue-300 break-all text-center block"
                    >
                      {transactionHash}
                    </a>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </DotBackground>
    )
  }

  if (loading || checkingWill) {
    return (
      <DotBackground>
        <div className="min-h-screen flex items-center justify-center">
          <Card className="w-full max-w-md bg-black/40 backdrop-blur-sm border-gray-800">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center space-y-4">
                <Loader2 className="h-10 w-10 animate-spin text-blue-400" />
                <p className="text-lg font-medium text-center text-white">
                  {checkingWill
                    ? "Checking your will status..."
                    : "Switching your network to Linea Chain Testnet and connecting Linea Legacy with it. Please accept the connection request in your wallet."}
                </p>
                <p className="text-sm text-gray-400 text-center">
                  This process may take a few seconds. Please be patient.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </DotBackground>
    )
  }

  if (hasWill) {
    return (
      <DotBackground>
        <div className="min-h-screen flex items-center justify-center">
          <Card className="w-full max-w-md bg-black/40 backdrop-blur-sm border-gray-800">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center space-y-4">
                <Loader2 className="h-10 w-10 animate-spin text-blue-400" />
                <p className="text-lg font-medium text-center text-white">
                  You already have an existing will. Redirecting you to the management page...
                </p>
                <p className="text-sm text-gray-400 text-center">Please wait a moment.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </DotBackground>
    )
  }

  // Wallet Info Component
  const WalletInfo = () => {
    if (!account) return null

    return (
      <Card className="mb-8 bg-black/40 backdrop-blur-sm border-gray-800">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div className="p-2 bg-blue-500/20 rounded-full">
                <Wallet className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Connected Wallet</p>
                <p className="font-medium text-white">
                  {account.slice(0, 6)}...{account.slice(-4)}
                </p>
              </div>
            </div>
            <div className="bg-gray-800/50 px-4 py-2 rounded-lg">
              <p className="text-sm text-gray-400">Balance</p>
              <p className="font-medium text-white">
                {Number(balance).toFixed(4)} <span className="text-blue-400">Linea</span>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const validateForm = () => {
    if (formData.assets.length < 50) {
      setValidationError("Description must be at least 50 characters long")
      return false
    }
    if (!formData.amount || Number.parseFloat(formData.amount) <= 0) {
      setValidationError("Initial deposit amount is required")
      return false
    }
    if (!isAddress(formData.beneficiary)) {
      setValidationError("Invalid beneficiary address")
      return false
    }

    if (!formData.claimWaitTime || Number.parseInt(formData.claimWaitTime) < 60) {
      setValidationError("Claim wait time must be at least 60 seconds")
      return false
    }

    if (!Object.values(confirmationChecks).every(Boolean)) {
      setValidationError("Please confirm all conditions before proceeding")
      return false
    }
    setValidationError("")
    return true
  }

  const goHome = () => {
    router.push("/")
  }

  return (
    <DotBackground>
      <div className="min-h-screen py-8 px-4">
        <div className="max-w-3xl mx-auto space-y-8">
          <Button
            onClick={goHome}
            variant="ghost"
            className="flex items-center text-gray-300 hover:text-white hover:bg-gray-800/50"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>

          <WalletInfo />

          {(error || validationError) && (
            <Alert variant="destructive" className="bg-red-900/70 border-red-700 text-white">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error || validationError}</AlertDescription>
            </Alert>
          )}

          <Card className="border-gray-800 bg-black/40 backdrop-blur-sm shadow-lg">
            <CardHeader>
              <CardTitle className="text-3xl font-display text-center bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
                Create Your Academic Legacy
              </CardTitle>
              <CardDescription className="text-center text-gray-400">
                Secure your educational assets and intellectual property on Linea Legacy
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="details" value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid grid-cols-2 mb-6 bg-gray-800/50">
                  <TabsTrigger
                    value="details"
                    className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                  >
                    Will Details
                  </TabsTrigger>
                  <TabsTrigger value="terms" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                    Terms & Conditions
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="mt-0">
                  <form className="space-y-6">
                    <div className="space-y-4">
                      <div className="relative">
                        <Label htmlFor="beneficiary" className="text-lg text-white flex items-center gap-2">
                          <GraduationCap className="w-4 h-4 text-blue-400" /> Academic Beneficiary Address
                        </Label>
                        <Input
                          type="text"
                          id="beneficiary"
                          name="beneficiary"
                          value={formData.beneficiary}
                          onChange={handleChange}
                          className="bg-gray-800/50 border-gray-700 text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-500 mt-2"
                          placeholder="0x..."
                          required
                        />
                      </div>

                      <div className="relative">
                        <Label htmlFor="amount" className="text-lg text-white flex items-center gap-2">
                          <BookOpen className="w-4 h-4 text-blue-400" /> Initial Linea Token Deposit
                        </Label>
                        <Input
                          type="number"
                          id="amount"
                          name="amount"
                          value={formData.amount}
                          onChange={handleChange}
                          className="bg-gray-800/50 border-gray-700 text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-500 mt-2"
                          placeholder="100"
                          step="0.000001"
                          min="0"
                          required
                        />
                        {formData.amount && (
                          <div className="mt-2 text-sm text-gray-400 flex items-center gap-2 bg-gray-800/30 p-3 rounded-lg">
                            <Info className="w-4 h-4 text-blue-400 flex-shrink-0" />
                            <div>
                              <p className="font-medium text-gray-300">Fee calculation:</p>
                              <p>
                                Final deposit:{" "}
                                <span className="text-blue-400 font-medium">
                                  {(Number(formData.amount) * 0.98).toFixed(6)} Linea
                                </span>{" "}
                                (2% supports Linea Legacy Scholarship)
                              </p>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="relative">
                        <Label htmlFor="assets" className="text-lg text-white flex items-center gap-2">
                          <ScrollText className="w-4 h-4 text-blue-400" /> Academic Assets Description
                        </Label>
                        <Textarea
                          id="assets"
                          name="assets"
                          value={formData.assets}
                          onChange={handleChange}
                          className="bg-gray-800/50 border-gray-700 text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-500 mt-2 min-h-[120px]"
                          placeholder="Describe your academic assets (research papers, intellectual property, educational resources)..."
                          required
                        />
                        <div className="mt-1 text-sm flex justify-between">
                          <span className={`${formData.assets.length < 50 ? "text-red-400" : "text-green-400"}`}>
                            {formData.assets.length}/50 characters minimum
                          </span>
                          {formData.assets.length < 50 && (
                            <span className="text-red-400">{50 - formData.assets.length} more characters needed</span>
                          )}
                        </div>
                      </div>

                      {/* Custom Claim Wait Time Section */}
                      <div className="relative">
                        <Label htmlFor="claimWaitTime" className="text-lg text-white flex items-center gap-2">
                          <Clock className="w-4 h-4 text-blue-400" /> Custom Claim Wait Time (only on Testnet)
                        </Label>
                        <div className="mt-2 p-4 rounded-lg bg-gray-800/30 border border-gray-700">
                          <Input
                            type="number"
                            id="claimWaitTime"
                            name="claimWaitTime"
                            value={formData.claimWaitTime}
                            onChange={handleChange}
                            className="bg-gray-800/50 border-gray-700 text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-500"
                            placeholder="60"
                            min="60"
                            required
                          />
                          <div className="mt-3 space-y-2">
                            <div className="flex items-start gap-2">
                              <Info className="w-4 h-4 mt-1 text-blue-400 flex-shrink-0" />
                              <div className="text-sm text-gray-400">
                                <p className="font-medium text-blue-400 mb-1">Testnet Configuration</p>
                                <p>
                                  For testing purposes, you can set a custom wait time (minimum 60 seconds). This allows
                                  you to experience the full functionality without waiting for extended periods.
                                </p>
                              </div>
                            </div>
                            <Separator className="my-2 bg-gray-700" />
                            <div className="flex items-start gap-2 mt-2">
                              <Clock className="w-4 h-4 mt-1 text-blue-400 flex-shrink-0" />
                              <div className="text-sm text-gray-400">
                                <p className="font-medium text-blue-400 mb-1">Mainnet Behavior</p>
                                <p>
                                  On mainnet, the wait time is automatically set to 10 years to ensure proper academic
                                  legacy protection. We value your feedback for potential improvements to this
                                  timeframe.
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <Button
                      type="button"
                      onClick={() => setActiveTab("terms")}
                      className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium py-3 rounded-full"
                    >
                      Continue to Terms & Conditions
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="terms" className="mt-0">
                  <div className="space-y-6">
                    <ConfirmationCheckboxes />

                    <div className="flex flex-col sm:flex-row gap-4 pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setActiveTab("details")}
                        className="border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white"
                      >
                        Back to Details
                      </Button>

                      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
                        <DialogTrigger asChild>
                          <Button
                            type="button"
                            disabled={!Object.values(confirmationChecks).every(Boolean)}
                            className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium py-3 rounded-full"
                          >
                            <AnimatedShinyText className="text-base">Secure Academic Legacy</AnimatedShinyText>
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md bg-black/80 backdrop-blur-xl rounded-2xl border-gray-800">
                          <DialogHeader>
                            <DialogTitle className="text-xl text-center text-white">Confirm Will Creation</DialogTitle>
                            <DialogDescription className="text-center text-gray-400">
                              Please review your will details before proceeding
                            </DialogDescription>
                          </DialogHeader>

                          <div className="space-y-4 py-4">
                            <div className="bg-gray-800/50 p-4 rounded-lg space-y-3">
                              <div className="flex justify-between">
                                <span className="text-gray-400">Beneficiary:</span>
                                <span className="text-white font-medium">{`${formData.beneficiary.slice(0, 6)}...${formData.beneficiary.slice(-4)}`}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-400">Amount:</span>
                                <span className="text-white font-medium">{formData.amount} Linea</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-400">Wait Time:</span>
                                <span className="text-white font-medium">{formData.claimWaitTime} seconds</span>
                              </div>
                            </div>

                            <div className="bg-gray-800/50 p-4 rounded-lg">
                              <h4 className="text-sm font-medium text-gray-300 mb-2">Assets Description:</h4>
                              <p className="text-sm text-gray-400 line-clamp-3">{formData.assets}</p>
                            </div>
                          </div>

                          <DialogFooter>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setOpenDialog(false)}
                              className="border-gray-700 text-gray-300 hover:bg-gray-800"
                            >
                              Cancel
                            </Button>
                            <Button
                              onClick={handleSubmit}
                              disabled={loading}
                              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
                            >
                              {loading ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Creating...
                                </>
                              ) : (
                                "Confirm & Create Will"
                              )}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </DotBackground>
  )
}

