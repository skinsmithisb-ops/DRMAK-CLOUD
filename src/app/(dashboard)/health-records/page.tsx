'use client';
import * as React from 'react';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FilePlus2, Printer, Save, PlusCircle, Trash2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { DatePicker } from '@/components/DatePicker';
import { useSearchParams } from 'next/navigation';
import { useFirestore, useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { Patient } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

// Mock data for dropdowns
const procedures = [
    { value: 'consultation', label: 'Consultation' },
    { value: 'laser_hair_removal', label: 'Laser Hair Removal' },
    { value: 'chemical_peel', label: 'Chemical Peel' },
];

const reprocedureOptions = [
    { value: 'follow_up', label: 'Follow-up Visit' },
    { value: 'routine_check', label: 'Routine Check-up' },
];

const summaryTemplates = [
    { value: 'acne_treatment', label: 'Acne Treatment Plan' },
    { value: 'anti_aging_regimen', label: 'Anti-Aging Regimen' },
]

export default function AddHealthRecordPage() {
    return (
        <React.Suspense fallback={<div className="flex items-center justify-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>}>
            <AddHealthRecordContent />
        </React.Suspense>
    );
}

function AddHealthRecordContent() {
    const searchParams = useSearchParams();
    const patientId = searchParams.get('id');
    const firestore = useFirestore();
    const { toast } = useToast();

    const patientDocRef = React.useMemo(() =>
        firestore && patientId ? doc(firestore, 'patients', patientId) : null,
        [firestore, patientId]
    );
    const { data: patient, isLoading: patientLoading } = useDoc<Patient>(patientDocRef);

    const [medicalHistory, setMedicalHistory] = React.useState([
        { id: 1, name: 'Medical History', value: '' },
        { id: 2, name: 'Complaint', value: '' },
        { id: 3, name: 'Diagnosis', value: '' },
        { id: 4, name: 'Clinical Notes', value: '' },
        { id: 5, name: 'Advice', value: '' },
        { id: 6, name: 'Investigation', value: '' },
        { id: 7, name: 'Plan', value: '' },
    ]);

    const handleHistoryChange = (id: number, newValue: string) => {
        setMedicalHistory(prev => prev.map(item => item.id === id ? { ...item, value: newValue } : item));
    };

    const handleHistoryAction = (id: number) => {
        toast({
            title: "Action triggered",
            description: `Action triggered for ${medicalHistory.find(i => i.id === id)?.name}`,
        });
    }

    const handlePlaceholderAction = (action: string) => {
        toast({
            title: "Feature coming soon",
            description: `${action} will be implemented shortly.`,
        });
    }

    const handleSave = async (print: boolean = false) => {
        if (!patientId) return;
        // In a real app, save to firestore/health-records
        toast({
            title: "Record Saved",
            description: print ? "Health record has been saved and sent to printer." : "Health record has been saved successfully.",
        });
        if (print) window.print();
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex flex-wrap items-center gap-4">
                            <h1 className="text-lg font-semibold">Add Health Record</h1>
                            {patient && (
                                <div className="text-sm p-2 bg-muted rounded-md border border-primary/20">
                                    <span className="font-bold">MRN#: {patient.id.slice(0, 8)}</span> | <span>{patient.name}</span> | <span className="text-muted-foreground">{patient.mobileNumber}</span>
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" onClick={() => handlePlaceholderAction("View all health records")}>View all health records</Button>
                            <Button variant="outline" onClick={() => handlePlaceholderAction("Copy previous record")}>Copy previous record</Button>
                            <Button variant="outline" onClick={() => handlePlaceholderAction("Copy from")}>Copy from</Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardContent className="p-4">
                            <Tabs defaultValue="prescription">
                                <TabsList>
                                    <TabsTrigger value="prescription">Prescription</TabsTrigger>
                                    <TabsTrigger value="vitals">Vitals</TabsTrigger>
                                    <TabsTrigger value="medication">Medication</TabsTrigger>
                                </TabsList>
                                <TabsContent value="prescription" className="pt-4 space-y-4">
                                    {medicalHistory.map(item => (
                                        <div key={item.id} className="grid grid-cols-[120px_1fr_auto] items-center gap-4">
                                            <Label className="text-right text-sm">{item.name}</Label>
                                            <Textarea
                                                value={item.value}
                                                onChange={(e) => handleHistoryChange(item.id, e.target.value)}
                                                rows={1}
                                                className="resize-none"
                                            />
                                            <Button variant="ghost" size="icon" onClick={() => handleHistoryAction(item.id)}><FilePlus2 className="h-4 w-4" /></Button>
                                        </div>
                                    ))}
                                    <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                                        <Label className="text-right text-sm">Procedure</Label>
                                        <div className="flex items-center gap-2">
                                            <Select>
                                                <SelectTrigger><SelectValue placeholder="Select Procedure" /></SelectTrigger>
                                                <SelectContent>
                                                    {procedures.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                            <Button variant="outline" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                                        <div></div>
                                        <Button variant="default" size="sm" className="w-fit"><PlusCircle className="mr-2 h-4 w-4" /> Add Procedure</Button>
                                    </div>
                                    <div className="grid grid-cols-[120px_1fr] items-start gap-4">
                                        <Label className="text-right text-sm pt-2">Reprocedure</Label>
                                        <div className="flex items-center gap-2">
                                            <Select>
                                                <SelectTrigger><SelectValue placeholder="Select one to reprocedure" /></SelectTrigger>
                                                <SelectContent>
                                                    {reprocedureOptions.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                            <div>
                                                <p className="text-xs text-muted-foreground mb-1">Recommended Follow up appointment date</p>
                                                <DatePicker date={undefined} onDateChange={() => { }} />
                                            </div>
                                        </div>
                                    </div>
                                </TabsContent>
                                <TabsContent value="vitals">
                                    <p className="p-4 text-center text-muted-foreground">Vitals will be managed here.</p>
                                </TabsContent>
                                <TabsContent value="medication">
                                    <p className="p-4 text-center text-muted-foreground">Medication details will be managed here.</p>
                                </TabsContent>
                            </Tabs>
                        </CardContent>
                    </Card>

                    <div className="flex items-center justify-between">
                        <Button variant="outline" onClick={() => handlePlaceholderAction("Print settings")}><Printer className="mr-2 h-4 w-4" /> Print settings</Button>
                        <div className="flex items-center gap-2">
                            <Button variant="default" onClick={() => handleSave(true)}><Save className="mr-2 h-4 w-4" /> Save & Print</Button>
                            <Button variant="secondary" onClick={() => handleSave(false)}><Save className="mr-2 h-4 w-4" /> Save</Button>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-1 space-y-6">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-base">Summary</CardTitle>
                                <div className="flex items-center space-x-2">
                                    <Label htmlFor="expansion-mode" className="text-sm">Expansion Mode</Label>
                                    <Switch id="expansion-mode" />
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <Select>
                                <SelectTrigger><SelectValue placeholder="Select Template" /></SelectTrigger>
                                <SelectContent>
                                    {summaryTemplates.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <div className="mt-4">
                                <Tabs defaultValue="templates">
                                    <TabsList className="grid w-full grid-cols-5">
                                        <TabsTrigger value="drugs">Drugs</TabsTrigger>
                                        <TabsTrigger value="templates">Templates</TabsTrigger>
                                        <TabsTrigger value="instruction">Instruction</TabsTrigger>
                                        <TabsTrigger value="frequency">Frequency</TabsTrigger>
                                        <TabsTrigger value="lab-order">Lab Order</TabsTrigger>
                                    </TabsList>
                                    <TabsContent value="templates" className="pt-4">
                                        <div className="text-center text-muted-foreground p-8 border-2 border-dashed rounded-lg">
                                            <p>Medicine list empty</p>
                                        </div>
                                    </TabsContent>
                                    <TabsContent value="drugs">
                                        <p className="text-center text-muted-foreground p-4">Drug selection will be here.</p>
                                    </TabsContent>
                                    {/* Other tabs content */}
                                </Tabs>
                            </div>
                            <div className="flex justify-end mt-4">
                                <Button onClick={() => handlePlaceholderAction("Add File")}><PlusCircle className="mr-2 h-4 w-4" />Add File</Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
