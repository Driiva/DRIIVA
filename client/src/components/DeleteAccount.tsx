/**
 * DELETE ACCOUNT (GDPR right to erasure)
 * ======================================
 * Confirmation modal then calls Cloud Function deleteUserAccount,
 * signs out, and redirects to home.
 */

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { isFirebaseConfigured } from "@/lib/firebase";
import { deleteUserAccount } from "@/lib/firestore";

interface DeleteAccountProps {
  /** Firebase Auth UID (required for Cloud Function). */
  userId: string;
}

export default function DeleteAccount({ userId }: DeleteAccountProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  const { logout } = useAuth();

  const handleDelete = async () => {
    if (!isFirebaseConfigured) {
      toast({
        title: "Delete unavailable",
        description: "Account deletion is available when signed in with your Driiva account.",
        variant: "destructive",
      });
      return;
    }
    if (!userId) {
      toast({
        title: "Error",
        description: "Unable to identify account.",
        variant: "destructive",
      });
      return;
    }
    setIsDeleting(true);
    try {
      await deleteUserAccount(userId);
      toast({
        title: "Account deleted",
        description: "Your account and all associated data have been permanently deleted.",
      });
      logout();
      window.location.href = "/";
    } catch (err) {
      const message = err instanceof Error ? err.message : "Deletion failed";
      toast({
        title: "Deletion failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="destructive"
          className="w-full bg-[#C0272D] hover:bg-[#A81F25]"
          disabled={!isFirebaseConfigured || !userId}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Delete Account
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="glass-morphism border-gray-700">
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete your
            account and remove all your data from our servers, including:
            <ul className="mt-2 ml-4 list-disc text-sm">
              <li>Your profile and account details</li>
              <li>All driving data and trip history (including GPS points)</li>
              <li>Policies and pool share records</li>
              <li>Your Firebase Auth login</li>
            </ul>
            You will need to sign up again to use Driiva.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-[#C0272D] hover:bg-[#A81F25]"
          >
            {isDeleting ? "Deleting…" : "Delete Account"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
