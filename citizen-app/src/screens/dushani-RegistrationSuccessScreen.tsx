import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import {
  FormScreenShell,
  FormSection,
  Notice,
  StatusPill,
  SubmitButton,
} from "../components/dushani-RegistrationUI";

interface RegistrationSuccessScreenProps {
  onBack: () => void;
  registrationType?: string;
}

const NEXT_STEPS = [
  {
    title: "Sign in",
    body: "Use the username and password you just created.",
  },
  {
    title: "Get alerts",
    body: "Receive hazard warnings for the districts you follow.",
  },
  {
    title: "Complete your profile",
    body: "Add skills, availability or resources from your dashboard.",
  },
];

const PENDING_TYPES = [
  "relief-agency",
  "organization-team-leader",
  "independent-team-leader",
];

export default function RegistrationSuccessScreen({
  onBack,
  registrationType,
}: RegistrationSuccessScreenProps) {
  const isPending = PENDING_TYPES.includes(registrationType ?? "");
  const isTeamLeader =
    registrationType === "organization-team-leader" ||
    registrationType === "independent-team-leader";
  const isOrganizationTeam = registrationType === "organization-team-leader";

  return (
    <FormScreenShell
      title={isPending ? "Registration submitted" : "Registration successful"}
      subtitle={
        isPending
          ? isTeamLeader
            ? "Your rescue team is awaiting approval"
            : "Your organization is awaiting verification"
          : "Your account is ready to use"
      }
      onBack={onBack}
    >
      <FormSection>
        <View className="items-center py-2">
          <View className="items-center justify-center w-20 h-20 mb-5 rounded-full bg-safeplus-lightGreen">
            <Ionicons
              name="checkmark-circle"
              size={52}
              color="#16A34A"
            />
          </View>
          <Text className="mb-3 text-xl font-extrabold text-safeplus-navy text-center">
            {isPending
              ? "Sent for verification"
              : "Welcome to SafePlus"}
          </Text>
          <Text className="mb-5 text-sm leading-6 text-safeplus-slate text-center">
            {isPending
              ? isTeamLeader
                ? `We are checking your team details. You will get an email once ${
                    isOrganizationTeam ? "your organization admin" : "a Super Admin"
                  } approves the team.`
                : "We are checking your official registration number. You will get an email once your organization is approved."
              : "Your account has been created. You can now sign in and access everything SafePlus offers."}
          </Text>
          <StatusPill
            tone={isPending ? "pending" : "active"}
            label={isPending ? "Pending verification" : "Account active"}
          />
        </View>
      </FormSection>

      <FormSection title="What you can do next" icon="compass-outline">
        <View className="space-y-4">
          {NEXT_STEPS.map((step, index) => (
            <View key={step.title} className="flex-row items-start">
              <View className="items-center justify-center w-8 h-8 mr-4 rounded-lg bg-safeplus-navy">
                <Text className="text-[13px] font-extrabold text-white">
                  {index + 1}
                </Text>
              </View>
              <View className="flex-1">
                <Text className="text-sm font-extrabold text-safeplus-navy">
                  {step.title}
                </Text>
                <Text className="mt-1 text-[13px] leading-5 text-safeplus-slate">
                  {step.body}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </FormSection>

      <View className="mb-5">
        <Notice
          tone={isPending ? "pending" : "info"}
          title={
            isPending
              ? isTeamLeader
                ? "Your team awaits approval"
                : "Verification usually takes 1 working day"
              : "Need a hand?"
          }
          body={
            isPending
              ? isTeamLeader
                ? `Your username signs you in to this app and to the SafePlus DMC portal. ${
                    isOrganizationTeam
                      ? "Your organization admin"
                      : "A Super Admin"
                  } approves the team before rescue assignments open.`
                : "You can sign in now to view your submission status, but relief requests unlock after approval."
              : "Email support@safeplus.gov.lk or call the DMC hotline on 1342 for help with your account."
          }
        />
      </View>

      <SubmitButton onPress={onBack} label="Return to login" />
    </FormScreenShell>
  );
}
