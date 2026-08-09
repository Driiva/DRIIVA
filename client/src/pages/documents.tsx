
import DashboardHeader from "@/components/DashboardHeader";
import { BottomNav as BottomNavigation } from "@/components/BottomNav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Download, Eye, Calendar } from "lucide-react";

export default function Documents() {
  const documents = [
    {
      id: 1,
      name: "Policy Agreement",
      type: "PDF",
      size: "2.4 MB",
      date: "2024-01-15"
    },
    {
      id: 2,
      name: "Terms & Conditions",
      type: "PDF", 
      size: "1.8 MB",
      date: "2024-01-15"
    },
    {
      id: 3,
      name: "Privacy Policy",
      type: "PDF",
      size: "1.2 MB", 
      date: "2024-01-15"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1E293B] to-[#0F172A] text-white safe-area">
      <DashboardHeader />
      
      <main className="px-4 pb-20">
        <div className="py-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold">Documents</h1>
          </div>

          <div className="space-y-4">
            {documents.map((doc) => (
              <Card key={doc.id} className="glass-morphism-subtle border-gray-700">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-[var(--app-primary)] bg-opacity-20 rounded-lg flex items-center justify-center">
                        <FileText className="w-5 h-5 text-[var(--app-primary)]" />
                      </div>
                      <div>
                        <h3 className="font-medium text-white">{doc.name}</h3>
                        <div className="flex items-center space-x-2 text-xs text-gray-400">
                          <span>{doc.type}</span>
                          <span>•</span>
                          <span>{doc.size}</span>
                          <span>•</span>
                          <Calendar className="w-3 h-3" />
                          <span>{doc.date}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <button className="glossy-button p-2 rounded-lg">
                        <Eye className="w-4 h-4 text-white" />
                      </button>
                      <button className="glossy-button p-2 rounded-lg">
                        <Download className="w-4 h-4 text-white" />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>

      <BottomNavigation />
    </div>
  );
}
