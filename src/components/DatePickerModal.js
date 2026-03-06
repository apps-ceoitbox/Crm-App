import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
} from 'react-native';
import IonIcon from 'react-native-vector-icons/Ionicons';
import { Colors } from '../constants/Colors';
import { Spacing, BorderRadius, Shadow } from '../constants/Spacing';
import { ms, vs } from '../utils/Responsive';

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

const DatePickerModal = ({ visible, onClose, onSelect, initialDate }) => {
  const [selectedDate, setSelectedDate] = useState(initialDate || new Date());
  const [currentMonthDate, setCurrentMonthDate] = useState(initialDate || new Date());

  const currentYear = currentMonthDate.getFullYear();
  const currentMonth = currentMonthDate.getMonth();
  const today = new Date();

  const handleMonthChange = (increment) => {
    const newDate = new Date(currentMonthDate);
    newDate.setMonth(currentMonth + increment);
    setCurrentMonthDate(newDate);
  };

  const handleSelectDay = (day) => {
    const newDate = new Date(currentYear, currentMonth, day);
    setSelectedDate(newDate);
    onSelect(newDate);
    onClose();
  };

  // Generate blank spaces for the start of the month
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
  const blanks = Array.from({ length: firstDay }, (_, i) => i);
  
  // Generate days in month
  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback>
            <View style={styles.modalContent}>
              <View style={styles.header}>
                <TouchableOpacity onPress={() => handleMonthChange(-1)}>
                  <IonIcon name="chevron-back" size={24} color={Colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.monthText}>
                  {MONTHS[currentMonth]} {currentYear}
                </Text>
                <TouchableOpacity onPress={() => handleMonthChange(1)}>
                  <IonIcon name="chevron-forward" size={24} color={Colors.textPrimary} />
                </TouchableOpacity>
              </View>

              <View style={styles.daysHeaderRow}>
                {DAYS_OF_WEEK.map((day, index) => (
                  <Text key={index} style={styles.dayHeaderText}>{day}</Text>
                ))}
              </View>

              <View style={styles.daysGrid}>
                {blanks.map((blank) => (
                  <View key={`blank-${blank}`} style={styles.dayCell} />
                ))}
                {days.map((day) => {
                  const isSelected = 
                    selectedDate.getDate() === day &&
                    selectedDate.getMonth() === currentMonth &&
                    selectedDate.getFullYear() === currentYear;
                    
                  const isToday = 
                    today.getDate() === day &&
                    today.getMonth() === currentMonth &&
                    today.getFullYear() === currentYear;

                  return (
                    <TouchableOpacity
                      key={day}
                      style={[
                        styles.dayCell, 
                        isToday && styles.todayCell,
                        isSelected && styles.selectedDayCell
                      ]}
                      onPress={() => handleSelectDay(day)}
                    >
                      <Text style={[
                        styles.dayText, 
                        isToday && styles.todayText,
                        isSelected && styles.selectedDayText
                      ]}>
                        {day}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    width: '100%',
    ...Shadow.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  monthText: {
    fontSize: ms(18),
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  daysHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceBorder,
    paddingBottom: Spacing.xs,
  },
  dayHeaderText: {
    width: '14%',
    textAlign: 'center',
    fontSize: ms(12),
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  dayCell: {
    width: '14.28%', // 100/7
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  selectedDayCell: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.round,
  },
  todayCell: {
    backgroundColor: Colors.primaryBackground,
    borderRadius: BorderRadius.round,
  },
  dayText: {
    fontSize: ms(15),
    color: Colors.textPrimary,
  },
  todayText: {
    color: Colors.primary,
    fontWeight: '600',
  },
  selectedDayText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  cancelButton: {
    marginTop: Spacing.lg,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: Colors.primary,
    fontSize: ms(16),
    fontWeight: '600',
  },
});

export default DatePickerModal;
