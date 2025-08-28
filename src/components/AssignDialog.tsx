import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { uniboxStore } from '@/store/uniboxStore';
import { toast } from 'sonner';

interface AssignDialogProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId: string;
  currentUserId: string;
  currentUserName: string;
}

const AssignDialog: React.FC<AssignDialogProps> = ({
  isOpen,
  onClose,
  conversationId,
  currentUserId,
  currentUserName,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const sdrs = uniboxStore.getSDRs();

  const handleAssign = async (assigneeId: string, assigneeName: string) => {
    setIsLoading(true);
    try {
      await uniboxStore.assign(conversationId, assigneeId, assigneeName);
      toast.success(`Assigned conversation to ${assigneeName}`);
      onClose();
    } catch (error) {
      toast.error('Failed to assign conversation');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Conversation</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Choose who to assign this conversation to:
          </div>
          
          <div className="space-y-2">
            {/* Me option */}
            <Button
              variant="outline"
              className="w-full justify-start h-auto p-4"
              onClick={() => handleAssign(currentUserId, currentUserName)}
              disabled={isLoading}
            >
              <Avatar className="w-8 h-8 mr-3">
                <AvatarFallback className="bg-primary/20 text-primary">
                  {currentUserName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="text-left">
                <div className="font-medium">Me ({currentUserName})</div>
                <div className="text-sm text-muted-foreground">Assign to yourself</div>
              </div>
            </Button>

            {/* Other SDRs */}
            {sdrs
              .filter(sdr => sdr.id !== currentUserId)
              .map(sdr => (
                <Button
                  key={sdr.id}
                  variant="outline"
                  className="w-full justify-start h-auto p-4"
                  onClick={() => handleAssign(sdr.id, sdr.name)}
                  disabled={isLoading}
                >
                  <Avatar className="w-8 h-8 mr-3">
                    <AvatarFallback className="bg-primary/20 text-primary">
                      {sdr.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-left">
                    <div className="font-medium">{sdr.name}</div>
                    <div className="text-sm text-muted-foreground">SDR</div>
                  </div>
                </Button>
              ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AssignDialog;
