import { useState, type ReactNode } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type IconName = keyof typeof Ionicons.glyphMap;

function fieldShell(error?: string): string {
  return error
    ? "border-safeplus-red bg-safeplus-lightRed"
    : "border-safeplus-hairline bg-safeplus-fieldBg";
}

export function FormScreenShell({
  title,
  subtitle,
  badge,
  onBack,
  headerExtra,
  children,
}: {
  title: string;
  subtitle: string;
  badge?: string;
  onBack: () => void;
  headerExtra?: ReactNode;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-safeplus-canvas">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <View
          className="bg-safeplus-navy px-5 pb-24 sm:px-8"
          style={{ paddingTop: insets.top + 24 }}
        >
          <View className="flex-row items-center">
            <Pressable
              onPress={onBack}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              className="items-center justify-center w-11 h-11 mr-4 rounded-xl bg-safeplus-navySoft active:opacity-80"
            >
              <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
            </Pressable>
            <View className="flex-1">
              <Text className="text-2xl font-extrabold text-white">
                {title}
              </Text>
              <Text className="mt-1 text-sm text-safeplus-navyText">
                {subtitle}
              </Text>
            </View>
            {badge && (
              <View className="px-3 py-2 rounded-full bg-safeplus-navySoft border border-safeplus-navyLine">
                <Text className="text-[11px] font-bold tracking-widest text-safeplus-navyText uppercase">
                  {badge}
                </Text>
              </View>
            )}
          </View>
          {headerExtra && <View className="mt-6">{headerExtra}</View>}
        </View>

        <View className="px-5 -mt-14 sm:px-8">
          <View className="w-full max-w-2xl mx-auto">{children}</View>
        </View>
      </ScrollView>
    </View>
  );
}

export function FormSection({
  title,
  caption,
  icon,
  children,
}: {
  title?: string;
  caption?: string;
  icon?: IconName;
  children: ReactNode;
}) {
  return (
    <View className="p-6 mb-5 bg-safeplus-surface rounded-3xl border border-safeplus-hairline shadow-sm sm:p-7">
      {title && (
        <View className="flex-row items-center mb-5">
          {icon && (
            <View className="items-center justify-center w-9 h-9 mr-3 rounded-xl bg-safeplus-blueSoft">
              <Ionicons name={icon} size={18} color="#1570EF" />
            </View>
          )}
          <View className="flex-1">
            <Text className="text-base font-extrabold text-safeplus-navy">
              {title}
            </Text>
            {caption && (
              <Text className="mt-0.5 text-xs text-safeplus-slate">
                {caption}
              </Text>
            )}
          </View>
        </View>
      )}
      {children}
    </View>
  );
}

function FieldLabel({
  label,
  optional,
  hint,
  locked,
}: {
  label: string;
  optional?: boolean;
  hint?: string;
  locked?: boolean;
}) {
  return (
    <View className="flex-row items-end justify-between mb-2">
      <Text className="text-[15px] font-bold text-safeplus-navy">
        {label}
        {!optional && !locked && <Text className="text-safeplus-red">  *</Text>}
      </Text>
      {optional ? (
        <Text className="text-[11px] font-bold text-safeplus-slate uppercase">
          Optional
        </Text>
      ) : (
        hint && <Text className="text-[11px] text-safeplus-slate">{hint}</Text>
      )}
    </View>
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;

  return (
    <View className="flex-row items-start mt-2">
      <Ionicons
        name="alert-circle"
        size={14}
        color="#D92D20"
        className="mr-1.5 mt-px"
      />
      <Text className="flex-1 text-xs font-semibold text-safeplus-red">
        {message}
      </Text>
    </View>
  );
}

export function Field({
  label,
  value,
  onChange,
  onBlur,
  error,
  placeholder,
  optional,
  keyboardType = "default",
  autoCapitalize = "none",
  editable = true,
  multiline,
}: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  placeholder?: string;
  optional?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: "none" | "words" | "sentences" | "characters";
  editable?: boolean;
  multiline?: boolean;
}) {
  return (
    <View>
      <FieldLabel
        label={label}
        optional={optional}
        locked={!editable}
      />
      <TextInput
        value={value}
        onChangeText={onChange}
        onBlur={onBlur}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        editable={editable}
        multiline={multiline}
        textAlignVertical={multiline ? "top" : undefined}
        className={`px-4 text-base text-safeplus-navy border rounded-xl ${
          multiline ? "h-28 py-3.5" : "h-14"
        } ${fieldShell(error)}`}
      />
      <FieldError message={error} />
    </View>
  );
}

export function PasswordField({
  label,
  value,
  onChange,
  onBlur,
  error,
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  placeholder?: string;
  hint?: string;
}) {
  const [revealed, setRevealed] = useState(false);

  return (
    <View>
      <FieldLabel label={label} hint={hint} />
      <View
        className={`flex-row items-center h-14 border rounded-xl ${fieldShell(
          error
        )}`}
      >
        <TextInput
          value={value}
          onChangeText={onChange}
          onBlur={onBlur}
          placeholder={placeholder}
          placeholderTextColor="#94A3B8"
          secureTextEntry={!revealed}
          autoCapitalize="none"
          autoCorrect={false}
          className="flex-1 px-4 text-base text-safeplus-navy"
        />
        <Pressable
          onPress={() => setRevealed((current) => !current)}
          accessibilityRole="button"
          accessibilityLabel={revealed ? "Hide password" : "Show password"}
          className="items-center justify-center px-4 h-full active:opacity-70"
        >
          <Ionicons
            name={revealed ? "eye-off-outline" : "eye-outline"}
            size={20}
            color="#64748B"
          />
        </Pressable>
      </View>
      <FieldError message={error} />
    </View>
  );
}

export function ChoiceField({
  label,
  value,
  options,
  onChange,
  error,
  optional,
  hint,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  error?: string;
  optional?: boolean;
  hint?: string;
}) {
  return (
    <View>
      <FieldLabel label={label} optional={optional} hint={hint} />
      <View className="flex-row flex-wrap gap-2">
        {options.map((option) => {
          const isSelected = value === option;

          return (
            <Pressable
              key={option}
              onPress={() => onChange(option)}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              className={`items-center justify-center px-5 h-12 rounded-xl border ${
                isSelected
                  ? "bg-safeplus-navy border-safeplus-navy"
                  : "bg-safeplus-fieldBg border-safeplus-hairline"
              }`}
            >
              <Text
                className={`text-sm font-bold ${
                  isSelected ? "text-white" : "text-safeplus-navy"
                }`}
              >
                {option}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <FieldError message={error} />
    </View>
  );
}

export function SubmitButton({
  onPress,
  disabled,
  label,
}: {
  onPress: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      className="flex-row items-center justify-center h-14 mb-5 rounded-xl bg-safeplus-blue shadow-sm active:opacity-85 disabled:opacity-60"
    >
      <Text className="text-base font-extrabold text-white">{label}</Text>
      <Ionicons
        name="arrow-forward"
        size={18}
        color="#FFFFFF"
        className="ml-2.5"
      />
    </Pressable>
  );
}

export function ErrorSummary({ count }: { count: number }) {
  if (count === 0) return null;

  return (
    <View className="flex-row items-center p-4 mb-5 rounded-2xl bg-safeplus-lightRed border border-safeplus-red">
      <Ionicons
        name="alert-circle"
        size={20}
        color="#D92D20"
        className="mr-3"
      />
      <Text className="flex-1 text-sm font-bold text-safeplus-red">
        {count === 1
          ? "1 field needs your attention before you continue."
          : `${count} fields need your attention before you continue.`}
      </Text>
    </View>
  );
}

export function RequestError({ message }: { message?: string | null }) {
  if (!message) return null;

  return (
    <View className="flex-row items-start p-4 mb-5 rounded-2xl bg-safeplus-lightRed border border-safeplus-red">
      <Ionicons
        name="cloud-offline-outline"
        size={20}
        color="#D92D20"
        className="mr-3 mt-0.5"
      />
      <Text className="flex-1 text-sm font-bold text-safeplus-red">
        {message}
      </Text>
    </View>
  );
}

const NOTICE_TONES = {
  info: {
    box: "bg-safeplus-blueSoft border-safeplus-blue",
    icon: "information-circle-outline",
    color: "#1570EF",
  },
  success: {
    box: "bg-safeplus-lightGreen border-safeplus-green",
    icon: "checkmark-circle-outline",
    color: "#16A34A",
  },
  pending: {
    box: "bg-safeplus-amberSoft border-safeplus-amber",
    icon: "time-outline",
    color: "#B54708",
  },
} as const;

export function Notice({
  tone = "info",
  title,
  body,
}: {
  tone?: keyof typeof NOTICE_TONES;
  title: string;
  body: string;
}) {
  const config = NOTICE_TONES[tone];

  return (
    <View className={`flex-row items-start p-4 rounded-2xl border ${config.box}`}>
      <Ionicons
        name={config.icon}
        size={20}
        color={config.color}
        className="mr-3 mt-0.5"
      />
      <View className="flex-1">
        <Text className="text-sm font-extrabold text-safeplus-navy">
          {title}
        </Text>
        <Text className="mt-1 text-xs leading-5 text-safeplus-slate">
          {body}
        </Text>
      </View>
    </View>
  );
}

export function StatusPill({
  tone,
  label,
}: {
  tone: "active" | "pending";
  label: string;
}) {
  return (
    <View
      className={`flex-row items-center self-start px-3 py-1.5 rounded-full border ${
        tone === "active"
          ? "bg-safeplus-lightGreen border-safeplus-green"
          : "bg-safeplus-amberSoft border-safeplus-amber"
      }`}
    >
      <View
        className={`w-2 h-2 mr-2 rounded-full ${
          tone === "active" ? "bg-safeplus-green" : "bg-safeplus-amber"
        }`}
      />
      <Text
        className={`text-[11px] font-extrabold tracking-wide uppercase ${
          tone === "active" ? "text-safeplus-green" : "text-safeplus-amber"
        }`}
      >
        {label}
      </Text>
    </View>
  );
}
