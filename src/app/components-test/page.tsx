"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { AlertCircle, CheckCircle2, Info } from "lucide-react"

export default function ComponentsTest() {
  const { success, error, info } = useToast()

  return (
    <div className="p-8 space-y-8 max-w-6xl mx-auto">
      <h1 className="text-4xl font-bold mb-8">Component Examples</h1>

      {/* Toast Examples */}
      <Card>
        <CardHeader>
          <CardTitle>Toast Notifications</CardTitle>
          <CardDescription>Click buttons to show different toast messages</CardDescription>
        </CardHeader>
        <CardContent className="space-x-4">
          <Button onClick={() => success("Success message!")}>
            Show Success Toast
          </Button>
          <Button onClick={() => error("Error message!")} variant="destructive">
            Show Error Toast
          </Button>
          <Button onClick={() => info("Info message!")} variant="outline">
            Show Info Toast
          </Button>
        </CardContent>
      </Card>

      {/* Button Examples */}
      <Card>
        <CardHeader>
          <CardTitle>Buttons</CardTitle>
          <CardDescription>Different button variants</CardDescription>
        </CardHeader>
        <CardContent className="space-x-4">
          <Button>Default</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="link">Link</Button>
        </CardContent>
      </Card>

      {/* Input Examples */}
      <Card>
        <CardHeader>
          <CardTitle>Form Elements</CardTitle>
          <CardDescription>Input fields and labels</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="Email" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" placeholder="Password" />
          </div>
        </CardContent>
      </Card>

      {/* Alert Examples */}
      <div className="space-y-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Default Alert</AlertTitle>
          <AlertDescription>
            This is a default alert with an icon.
          </AlertDescription>
        </Alert>

        <Alert variant="success">
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Success Alert</AlertTitle>
          <AlertDescription>
            Operation completed successfully!
          </AlertDescription>
        </Alert>

        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Alert</AlertTitle>
          <AlertDescription>
            Something went wrong. Please try again.
          </AlertDescription>
        </Alert>

        <Alert variant="info">
          <Info className="h-4 w-4" />
          <AlertTitle>Info Alert</AlertTitle>
          <AlertDescription>
            This is an informational message.
          </AlertDescription>
        </Alert>
      </div>

      {/* Badge Examples */}
      <Card>
        <CardHeader>
          <CardTitle>Badges</CardTitle>
          <CardDescription>Different badge variants</CardDescription>
        </CardHeader>
        <CardContent className="space-x-4">
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="destructive">Destructive</Badge>
          <Badge variant="outline">Outline</Badge>
        </CardContent>
      </Card>

      {/* Accordion Example */}
      <Card>
        <CardHeader>
          <CardTitle>Accordion</CardTitle>
          <CardDescription>Expandable content sections</CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible>
            <AccordionItem value="item-1">
              <AccordionTrigger>Is it accessible?</AccordionTrigger>
              <AccordionContent>
                Yes. It adheres to the WAI-ARIA design pattern.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2">
              <AccordionTrigger>Is it styled?</AccordionTrigger>
              <AccordionContent>
                Yes. It comes with default styles that matches the other components&apos; aesthetic.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-3">
              <AccordionTrigger>Is it animated?</AccordionTrigger>
              <AccordionContent>
                Yes. It&apos;s animated by default, but you can disable it if you prefer.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      {/* Dialog Example */}
      <Card>
        <CardHeader>
          <CardTitle>Dialog</CardTitle>
          <CardDescription>Modal dialog example</CardDescription>
        </CardHeader>
        <CardContent>
          <Dialog>
            <DialogTrigger asChild>
              <Button>Open Dialog</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Are you sure?</DialogTitle>
                <DialogDescription>
                  This action cannot be undone. This will permanently delete your account
                  and remove your data from our servers.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline">Cancel</Button>
                <Button>Continue</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      {/* Skeleton Example */}
      <Card>
        <CardHeader>
          <CardTitle>Skeleton Loading</CardTitle>
          <CardDescription>Loading placeholder components</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-4">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-[250px]" />
              <Skeleton className="h-4 w-[200px]" />
            </div>
          </div>
          <Skeleton className="h-[125px] w-full rounded-xl" />
        </CardContent>
      </Card>
    </div>
  )
}