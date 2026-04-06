import { Component, ElementRef, TemplateRef, ViewChild } from '@angular/core';
import { Store, Select } from '@ngxs/store';
import { FormBuilder, FormControl, FormGroup, Validators, FormArray, AbstractControl, ValidationErrors } from '@angular/forms';
import { Select2Data, Select2UpdateEvent } from 'ng-select2-component';
import { Router } from '@angular/router';
import { Observable, Subscription, map, of } from 'rxjs';
import { Breadcrumb } from '../../../shared/interface/breadcrumb';
import { AccountUser } from "../../../shared/interface/account.interface";
import { AccountState } from '../../../shared/state/account.state';
import { CartState } from '../../../shared/state/cart.state';
import { OrderState } from '../../../shared/state/order.state';
import { Checkout, PlaceOrder } from '../../../shared/action/order.action';
import { ClearCart, SyncCart, GetCartItems } from '../../../shared/action/cart.action';
import { Register } from '../../../shared/action/auth.action';
import { GetUserDetails } from '../../../shared/action/account.action';
import { AddressModalComponent } from '../../../shared/components/widgets/modal/address-modal/address-modal.component';
import { Cart } from '../../../shared/interface/cart.interface';
import { SettingState } from '../../../shared/state/setting.state';
import { GetSettingOption } from '../../../shared/action/setting.action';
import { OrderCheckout } from '../../../shared/interface/order.interface';
import { Values, DeliveryBlock } from '../../../shared/interface/setting.interface';
import { CartService } from '../../../shared/services/cart.service';
import { CountryState } from '../../../shared/state/country.state';
import { StateState } from '../../../shared/state/state.state';
import { AuthState } from '../../../shared/state/auth.state';
import * as data from '../../../shared/data/country-code';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { DomSanitizer } from '@angular/platform-browser';
import { interval } from 'rxjs';
import { delay, switchMap, takeWhile, tap } from 'rxjs/operators';
import { OrderService } from '../../../shared/services/order.service';
import { v4 as uuidv4 } from 'uuid';
import { NotificationService } from '../../../shared/services/notification.service';
// import { PaymentInitModal } from 'pg-test-project';
// import * as React from 'react';

interface PaymentResponse {
  R: boolean;
  data: {
    payment_url?: string;
    action?: string;
    inputs?: { [key: string]: string };
  };
  msg?: string;
}

interface PaymentError {
  error?: {
    message: string;
  };
  message?: string;
}

@Component({
  selector: 'app-checkout',
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.scss']
})
export class CheckoutComponent {

  public breadcrumb: Breadcrumb = {
    title: "Checkout",
    items: [{ label: 'Checkout', active: true }]
  }

  @Select(AccountState.user) user$: Observable<AccountUser>;
  @Select(AuthState.accessToken) accessToken$: Observable<string>;
  @Select(CartState.cartItems) cartItem$: Observable<Cart[]>;
  @Select(OrderState.checkout) checkout$: Observable<OrderCheckout>;
  @Select(SettingState.setting) setting$: Observable<Values>;
  @Select(CartState.cartHasDigital) cartDigital$: Observable<boolean | number>;
  @Select(CountryState.countries) countries$: Observable<Select2Data>;
  
  @ViewChild("addressModal") AddressModal: AddressModalComponent;
  @ViewChild('cpn', { static: false }) cpnRef: ElementRef<HTMLInputElement>;
  @ViewChild("payByQRModal") payByQRModal: TemplateRef<any>;
  @ViewChild('checkoutForm') checkoutForm: any;

  public form: FormGroup;
  public coupon: boolean = true;
  public couponCode: string;
  public appliedCoupon: boolean = false;
  public couponError: string | null;
  public checkoutTotal: OrderCheckout;
  public loading: boolean = false;

  public shippingStates$: Observable<Select2Data>;
  public billingStates$: Observable<Select2Data>;
  public codes = data.countryCodes;

  public formData!: any;
  public cartItems: Cart[] = [];
  public localSubTotal: number = 0;
  public localShippingTotal: number = 0;
  public localTaxTotal: number = 0;
  public localGrandTotal: number = 0;
  public registering: boolean = false;
  public registerError: string | null = null;

  private pollingSubscription!: Subscription;

  // Custom validator for name and title fields - only letters and spaces allowed
  private nameValidator(control: AbstractControl): ValidationErrors | null {
    if (!control.value) {
      return null;
    }
    const namePattern = /^[a-zA-Z]+(\s[a-zA-Z]+)*$/;
    const trimmedValue = control.value.trim();
    
    if (trimmedValue.length < 2) {
      return { invalidName: true };
    }
    
    return namePattern.test(control.value) ? null : { invalidName: true };
  }

  // Method to prevent special characters and numbers on input for name fields
  public onNameInput(event: any): void {
    const input = event.target;
    const value = input.value;
    // Remove special characters and numbers, keep only letters and spaces
    const filteredValue = value.replace(/[^a-zA-Z\s]/g, '');
    // Remove extra spaces and ensure proper formatting
    const formattedValue = filteredValue.replace(/\s+/g, ' ').trim();
    
    if (value !== filteredValue) {
      input.value = filteredValue;
      // Update the form control value
      const formControlName = input.getAttribute('formControlName');
      if (formControlName) {
        this.form.get(formControlName)?.setValue(filteredValue, { emitEvent: false });
      }
    }
  }

  // Method to prevent special characters and numbers on input for title fields
  public onTitleInput(event: any): void {
    const input = event.target;
    const value = input.value;
    // Remove special characters and numbers, keep only letters and spaces
    const filteredValue = value.replace(/[^a-zA-Z\s]/g, '');
    // Remove extra spaces and ensure proper formatting
    const formattedValue = filteredValue.replace(/\s+/g, ' ').trim();
    
    if (value !== filteredValue) {
      input.value = filteredValue;
      // Update the form control value
      const formControlName = input.getAttribute('formControlName');
      if (formControlName) {
        this.form.get(formControlName)?.setValue(filteredValue, { emitEvent: false });
      }
    }
  }

  // Method to prevent typing special characters and numbers in real-time for name fields
  public onNameKeypress(event: KeyboardEvent): boolean {
    const char = String.fromCharCode(event.which);
    const pattern = /[a-zA-Z\s]/;
    
    if (!pattern.test(char)) {
      event.preventDefault();
      return false;
    }
    return true;
  }

  // Method to prevent typing special characters and numbers in real-time for title fields
  public onTitleKeypress(event: KeyboardEvent): boolean {
    const char = String.fromCharCode(event.which);
    const pattern = /[a-zA-Z\s]/;
    
    if (!pattern.test(char)) {
      event.preventDefault();
      return false;
    }
    return true;
  }

  // Method to prevent non-numeric input in phone field
  public onPhoneInput(event: any): void {
    const input = event.target;
    const value = input.value;
    // Get the form control name from the input element
    const formControlName = input.getAttribute('formControlName');
    
    // Remove any non-numeric characters
    const numericValue = value.replace(/[^0-9]/g, '');
    
    if (value !== numericValue) {
      input.value = numericValue;
      // Update the form control value
      if (formControlName) {
        this.form.get(formControlName)?.setValue(numericValue, { emitEvent: false });
      }
    }
    
    // Limit to 10 digits
    if (numericValue.length > 10) {
      const truncatedValue = numericValue.slice(0, 10);
      input.value = truncatedValue;
      if (formControlName) {
        this.form.get(formControlName)?.setValue(truncatedValue, { emitEvent: false });
      }
    }
  }

  // Method to prevent typing alphabets in real-time for phone fields
  public onPhoneKeypress(event: KeyboardEvent): boolean {
    const char = String.fromCharCode(event.which);
    const pattern = /[0-9]/;
    
    if (!pattern.test(char)) {
      event.preventDefault();
      return false;
    }
    return true;
  }

  // Method to prevent pasting invalid content in name field
  public onNamePaste(event: ClipboardEvent): void {
    event.preventDefault();
    const pastedText = event.clipboardData?.getData('text/plain') || '';
    const filteredText = pastedText.replace(/[^a-zA-Z\s]/g, '');
    const formattedText = filteredText.replace(/\s+/g, ' ').trim();
    
    if (formattedText) {
      const input = event.target as HTMLInputElement;
      input.value = formattedText;
      const formControlName = input.getAttribute('formControlName');
      if (formControlName) {
        this.form.get(formControlName)?.setValue(formattedText, { emitEvent: false });
      }
    }
  }

  // Method to prevent pasting invalid content in title field
  public onTitlePaste(event: ClipboardEvent): void {
    event.preventDefault();
    const pastedText = event.clipboardData?.getData('text/plain') || '';
    const filteredText = pastedText.replace(/[^a-zA-Z\s]/g, '');
    const formattedText = filteredText.replace(/\s+/g, ' ').trim();
    
    if (formattedText) {
      const input = event.target as HTMLInputElement;
      input.value = formattedText;
      const formControlName = input.getAttribute('formControlName');
      if (formControlName) {
        this.form.get(formControlName)?.setValue(formattedText, { emitEvent: false });
      }
    }
  }

  // Method to prevent pasting invalid content in phone field
  public onPhonePaste(event: ClipboardEvent): void {
    event.preventDefault();
    const pastedText = event.clipboardData?.getData('text/plain') || '';
    const numericText = pastedText.replace(/[^0-9]/g, '');
    const truncatedText = numericText.slice(0, 10);
    
    if (truncatedText) {
      const input = event.target as HTMLInputElement;
      input.value = truncatedText;
      const formControlName = input.getAttribute('formControlName');
      if (formControlName) {
        this.form.get(formControlName)?.setValue(truncatedText, { emitEvent: false });
      }
    }
  }

  // Custom validator for password field - minimum 8 characters
  private passwordValidator(control: AbstractControl): ValidationErrors | null {
    if (!control.value) {
      return null;
    }
    if (control.value.length < 8) {
      return { invalidPassword: true };
    }
    return null;
  }
  private pollingInterval = 5000; // Poll every 5 seconds

  storeData: any;
  localUserCheck: any;

  payByNeoKredIntentSaveData: any;
  payByNeoStep = 0;
  payment_method = '';

  // Sub Paisa Config
  // @ViewChild('SubPaisaSdk', { static: true }) containerRef!: ElementRef;
  // formData = {
  //   env: 'stag',
  //   clientCode: 'LPS01',
  //   onToggle:() =>this.render(false) 
  // };
  // reactRoot: any = null;

  constructor(
    private store: Store, private router: Router,
    private formBuilder: FormBuilder, public cartService: CartService,
        private modalService: NgbModal,
        private sanitizer: DomSanitizer,
        private orderService: OrderService,
        private notificationService: NotificationService
      ) {
    this.store.dispatch(new GetSettingOption());

    this.form = this.formBuilder.group({
      products: this.formBuilder.array([], [Validators.required]),
      shipping_address_id: new FormControl('', [Validators.required]),
      billing_address_id: new FormControl('', [Validators.required]),
      points_amount: new FormControl(false),
      wallet_balance: new FormControl(false),
      coupon: new FormControl(),
      delivery_description: new FormControl('', [Validators.required]),
      delivery_interval: new FormControl(),
      payment_method: new FormControl('', [Validators.required]),
      create_account: new FormControl(false),
      name: new FormControl('', [Validators.required, this.nameValidator.bind(this)]),
      email: new FormControl('', [Validators.required, Validators.email]),
      country_code: new FormControl('91', [Validators.required]),
      phone: new FormControl('', [Validators.required, Validators.pattern(/^[0-9]{10}$/)]),
      password: new FormControl('', [Validators.required, this.passwordValidator.bind(this)]),
      shipping_address: new FormGroup({
        title: new FormControl('', [Validators.required, this.nameValidator.bind(this)]),
        street: new FormControl('', [Validators.required]),
        city: new FormControl('', [Validators.required]),
        phone: new FormControl('', [Validators.required, Validators.pattern(/^[0-9]{10}$/)]),
        pincode: new FormControl('', [Validators.required]),
        country_code: new FormControl('91', [Validators.required]),
        country_id: new FormControl('', [Validators.required]),
        state_id: new FormControl('', [Validators.required]),
      }),
      billing_address: new FormGroup({
        same_shipping: new FormControl(false),
        title: new FormControl('', [Validators.required, this.nameValidator.bind(this)]),
        street: new FormControl('', [Validators.required]),
        city: new FormControl('', [Validators.required]),
        phone: new FormControl('', [Validators.required, Validators.pattern(/^[0-9]{10}$/)]),
        pincode: new FormControl('', [Validators.required]),
        country_code: new FormControl('91', [Validators.required]),
        country_id: new FormControl('', [Validators.required]),
        state_id: new FormControl('', [Validators.required]),
      })
    });
    
    const settingSnapshot = this.store.selectSnapshot(state => state.setting)?.setting;
    if (settingSnapshot?.activation) {
      settingSnapshot.activation.guest_checkout = true;
    }
    
    if(this.store.selectSnapshot(state => state.auth && state.auth.access_token)) {
      this.form.removeControl('create_account');
      this.form.removeControl('name');
      this.form.removeControl('email');
      this.form.removeControl('country_code');
      this.form.removeControl('phone');
      this.form.removeControl('password');
      this.form.removeControl('password_confirmation');
      this.form.removeControl('shipping_address');
      this.form.removeControl('billing_address');

      this.cartDigital$.subscribe(value => {
        if(value == 1) {
          this.form.controls['shipping_address_id'].clearValidators();
          this.form.controls['delivery_description'].clearValidators();
        } else {
          this.form.controls['shipping_address_id'].setValidators([Validators.required]);
          this.form.controls['delivery_description'].setValidators([Validators.required]);
        }
        this.form.controls['shipping_address_id'].updateValueAndValidity();
        this.form.controls['delivery_description'].updateValueAndValidity();
      });

    } else {

      if(this.store.selectSnapshot(state => state.setting).setting.activation.guest_checkout) {
        this.form.removeControl('shipping_address_id');
        this.form.removeControl('billing_address_id');
        this.form.removeControl('points_amount');
        this.form.removeControl('wallet_balance');
        
        this.form.controls['create_account'].valueChanges.subscribe(value => {
          if(value) {
            this.form.controls['name'].setValidators([Validators.required]);
            this.form.controls['password'].setValidators([Validators.required]);
          } else {
            this.form.controls['name'].clearValidators();
            this.form.controls['password'].clearValidators();
          }
          this.form.controls['name'].updateValueAndValidity();
          this.form.controls['password'].updateValueAndValidity();
        });

        this.form.statusChanges.subscribe(value => {
          if(value == 'VALID') {
            this.checkout();
          }
        });

      }

    }

    this.form.get('billing_address.same_shipping')?.valueChanges.subscribe(value => {
      if(value) {
        this.form.get('billing_address.title')?.setValue(this.form.get('shipping_address.title')?.value);
        this.form.get('billing_address.street')?.setValue(this.form.get('shipping_address.street')?.value);
        this.form.get('billing_address.country_id')?.setValue(this.form.get('shipping_address.country_id')?.value);
        this.form.get('billing_address.state_id')?.setValue(this.form.get('shipping_address.state_id')?.value);
        this.form.get('billing_address.city')?.setValue(this.form.get('shipping_address.city')?.value);
        this.form.get('billing_address.pincode')?.setValue(this.form.get('shipping_address.pincode')?.value);
        this.form.get('billing_address.country_code')?.setValue(this.form.get('shipping_address.country_code')?.value);
        this.form.get('billing_address.phone')?.setValue(this.form.get('shipping_address.phone')?.value);
      } else {
        this.form.get('billing_address.title')?.setValue('');
        this.form.get('billing_address.street')?.setValue('');
        this.form.get('billing_address.country_id')?.setValue('');
        this.form.get('billing_address.state_id')?.setValue('');
        this.form.get('billing_address.city')?.setValue('');
        this.form.get('billing_address.pincode')?.setValue('');
        this.form.get('billing_address.country_code')?.setValue('');
        this.form.get('billing_address.phone')?.setValue('');
      }
    });
    
    this.cartService.getUpdateQtyClickEvent().subscribe(() => {
      this.products();
      this.checkout();
    });

    this.form.controls['phone']?.valueChanges.subscribe((value) => {
      if (value && value.toString().length !== 10) {
        this.form.controls['phone'].markAsTouched();
        this.form.controls['phone'].setErrors({invalid: true});
      } else if (value && value.toString().length === 10) {
        this.form.controls['phone'].setErrors(null);
      }
    });

    this.form.get('shipping_address.phone')?.valueChanges.subscribe((value) => {
      if (value && value.toString().length !== 10) {
        this.form.get('shipping_address.phone')?.markAsTouched();
        this.form.get('shipping_address.phone')?.setErrors({invalid: true});
      } else if (value && value.toString().length === 10) {
        this.form.get('shipping_address.phone')?.setErrors(null);
      }
    });

    this.form.get('billing_address.phone')?.valueChanges.subscribe((value) => {
      if (value && value.toString().length !== 10) {
        this.form.get('billing_address.phone')?.markAsTouched();
        this.form.get('billing_address.phone')?.setErrors({invalid: true});
      } else if (value && value.toString().length === 10) {
        this.form.get('billing_address.phone')?.setErrors(null);
      }
    });
    
    const accountRaw = localStorage.getItem('account');
    this.localUserCheck = accountRaw ? JSON.parse(accountRaw) : null;
    
  }

  get productControl(): FormArray {
    return this.form.get("products") as FormArray;
  }

  // private render(isOpen: boolean){
  //   this.reactRoot.render(
  //     React.createElement(PaymentInitModal, { ...this.formData as any, isOpen })
  //   )
  // }

  ngOnInit() {
    this.checkout$.subscribe(data => this.checkoutTotal = data);
    this.products();
  }

  products() {
    this.cartItems = this.loadCartItems();
    this.rebuildProductControls(this.cartItems);
    this.computeLocalTotals(this.cartItems);

    // Keep ngxs state in sync with whatever we loaded
    this.cartItem$.subscribe(items => {
      const merged = (items && items.length) ? items : this.loadCartItems();
      this.cartItems = merged;
      this.rebuildProductControls(merged);
      this.computeLocalTotals(merged);
    });
  }

  private computeLocalTotals(items: Cart[]) {
    const sub = (items || []).reduce((sum, item) => {
      const unit = item?.variation?.sale_price
        ?? (item?.wholesale_price ?? item?.product?.sale_price ?? 0);
      const qty = item?.quantity || 0;
      return sum + Number(unit) * Number(qty);
    }, 0);

    // Read tax/shipping config from settings if available
    const setting: any = this.store.selectSnapshot((s: any) => s.setting?.setting);
    const taxRate = Number(setting?.tax?.tax_value) || 0;
    const taxIsPercent = setting?.tax?.tax_type !== 'fix';
    const freeShipAt = Number(setting?.general?.min_order_free_shipping) || 0;
    const flatShipping = Number(setting?.shipping?.shipping_fee) || 0;

    const tax = taxIsPercent ? (sub * taxRate) / 100 : taxRate;
    const shipping = (freeShipAt && sub >= freeShipAt) ? 0 : flatShipping;

    this.localSubTotal = sub;
    this.localTaxTotal = tax;
    this.localShippingTotal = shipping;
    this.localGrandTotal = sub + tax + shipping;
  }

  private loadCartItems(): Cart[] {
    // 1. Dedicated guest_cart key (most authoritative for guests)
    try {
      const rawGuest = localStorage.getItem('guest_cart');
      if (rawGuest) {
        const parsed = JSON.parse(rawGuest);
        if (parsed?.items?.length) return parsed.items;
      }
    } catch {}

    // 2. NgXS state snapshot
    const snapshot = this.store.selectSnapshot(CartState.cartItems);
    if (snapshot && snapshot.length) return snapshot;

    // 3. NgXS storage-plugin persisted 'cart' key
    try {
      const rawCart = localStorage.getItem('cart');
      if (rawCart) {
        const parsed = JSON.parse(rawCart);
        if (parsed?.items?.length) return parsed.items;
      }
    } catch {}

    return [];
  }

  private rebuildProductControls(items: Cart[]) {
    this.productControl.clear();
    (items || []).forEach((item: Cart) =>
      this.productControl.push(
        this.formBuilder.group({
          product_id: new FormControl(item?.product_id, [Validators.required]),
          variation_id: new FormControl(item?.variation_id ? item?.variation_id : ''),
          quantity: new FormControl(item?.quantity),
        })
      )
    );
  }

  registerAndContinue() {
    this.registerError = null;

    const name = this.form.get('name')?.value;
    const email = this.form.get('email')?.value;
    const phone = this.form.get('phone')?.value;
    const country_code = this.form.get('country_code')?.value;
    const password = this.form.get('password')?.value;

    // Validate the required register fields
    this.form.get('name')?.markAsTouched();
    this.form.get('email')?.markAsTouched();
    this.form.get('phone')?.markAsTouched();
    this.form.get('password')?.markAsTouched();

    if (!name || !email || !phone || !password ||
        this.form.get('name')?.invalid ||
        this.form.get('email')?.invalid ||
        this.form.get('phone')?.invalid ||
        this.form.get('password')?.invalid) {
      this.registerError = 'Please fill name, email, phone and password correctly.';
      return;
    }

    this.registering = true;

    const payload = {
      name,
      email,
      phone: Number(phone),
      country_code: Number(country_code),
      password,
      password_confirmation: password,
    };

    this.store.dispatch(new Register(payload)).subscribe({
      next: () => {
        // Sync guest cart items to the server
        const guestItems = this.cartItems || [];
        const syncPayload = guestItems.map(i => ({
          id: null,
          product: i.product,
          product_id: i.product_id,
          variation: i.variation,
          variation_id: i.variation_id ?? null,
          quantity: i.quantity,
        })) as any;

        const finalize = () => {
          // Clear the guest_cart key since it's now on the server
          try { localStorage.removeItem('guest_cart'); } catch {}
          this.store.dispatch(new GetUserDetails()).subscribe({
            complete: () => {
              this.store.dispatch(new GetCartItems()).subscribe({
                complete: () => {
                  this.registering = false;
                  // Reload checkout to switch the form into logged-in mode
                  this.router.navigateByUrl('/', { skipLocationChange: true })
                    .then(() => this.router.navigate(['/checkout']));
                }
              });
            }
          });
        };

        if (syncPayload.length) {
          this.store.dispatch(new SyncCart(syncPayload)).subscribe({
            complete: finalize,
            error: () => finalize(),
          });
        } else {
          finalize();
        }
      },
      error: (err: any) => {
        this.registering = false;
        this.registerError = err?.message || 'Registration failed. Please try again.';
      }
    });
  }

  selectShippingAddress(id: number) {
    if(id) {
      this.form.controls['shipping_address_id'].setValue(Number(id));
      this.checkout();
    }
  }

  selectBillingAddress(id: number) {
    if(id) {
      this.form.controls['billing_address_id'].setValue(Number(id));
      this.checkout();
    }
  }

  selectDelivery(value: DeliveryBlock) {
    this.form.controls['delivery_description'].setValue(value?.delivery_description);
    this.form.controls['delivery_interval'].setValue(value?.delivery_interval);
    this.checkout();
  }

  selectPaymentMethod(value: string) {
    this.form.controls['payment_method'].setValue(value);
    this.payment_method = value;
    switch (value) {
      case 'neoKred':
        // Call Popup for NeoKred QR Code
        this.checkout(value);
        break;
      case 'sub_paisa':
        this.checkout(value);
        break;  
      case 'cash_free':
        this.checkout(value);
        break;  
      case 'fashionwithtrends_neokred':
        this.checkout(value);
        break;
      case 'gaonvashi_cashfree':
        this.checkout(value);
        break;
      default:
        break;
    }
  }

  initiateSubPaisa(payment_method: string, uuid: any, order_result: any) {
    const userData = localStorage.getItem('account');
    const payload = {
      uuid,
      ...JSON.parse(userData || '').user,
      checkout: this.storeData?.order?.checkout
    }
    this.cartService.initiateSubPaisa(
      { 
        uuid: payload.uuid, 
        email: payload.email,
        total: this.storeData?.order?.checkout?.total?.total,
        phone: JSON.parse(userData || '').user.phone,
        name: JSON.parse(userData || '').user.name,
        address: JSON.parse(userData || '').user.address[0].city + ' ' + JSON.parse(userData || '').user.address[0].area
      }
    ).subscribe({
      next: (data) => {
        if (data) {
          // Store payment info in session storage
          sessionStorage.setItem('payment_uuid', uuid);
          sessionStorage.setItem('payment_method', payment_method);
          sessionStorage.setItem('payment_action', JSON.stringify(this.form.value));
          localStorage.setItem('order_id', JSON.stringify(order_result.order_number));

          // Create a temporary form and submit it
          const form = document.createElement('form');
          form.method = 'POST';
          form.action = data.data.action || data.data;
          form.target = '_self';
          
          // Add any required form fields from data.data
          if (data.data.inputs) {
            Object.keys(data.data.inputs).forEach(key => {
              const input = document.createElement('input');
              input.type = 'hidden';
              input.name = key;
              input.value = data.data.inputs[key];
              form.appendChild(input);
            });
          }
          
          document.body.appendChild(form);
          form.submit();
          document.body.removeChild(form);
        }
      },
      error: (err) => {
        console.log(err);
      }
    });
  }

  startPollingForPaymentStatus(uuid: any, action: any, paymentWindow: Window | null, payment_method: string) {
    if (!paymentWindow) return;

    let windowClosedManually = false;

    // ✅ Start monitoring the payment window's URL and check if it's closed
    const urlCheckInterval = setInterval(() => {
        try {
            if (paymentWindow.closed) {
                console.log("Payment window closed manually or due to an issue.");
                clearInterval(urlCheckInterval);
                windowClosedManually = true;

                // ✅ If closed manually, inform the frontend
                this.handlePaymentSuccess({ status: false, reason: "Window closed manually" }, action, uuid, payment_method);
                return;
            }

            const currentUrl = paymentWindow.location.href;
            console.log("Current Payment Window URL:", currentUrl);

            // ✅ Check if redirected to success or failure page
            if (currentUrl.includes("success") || currentUrl.includes("failure")) {
                console.log("Redirect detected, closing window.");
                clearInterval(urlCheckInterval);
                paymentWindow.close();

                // ✅ Process the response
                this.handlePaymentSuccess({ status: true, url: currentUrl }, action, uuid, payment_method);
            }
        } catch (error) {
            // Catches CORS-related issues if the domain changes
            console.warn("Unable to access payment window URL (possible CORS issue).");
        }
    }, 1000); // Check every second

    // ✅ Continue polling for payment status
    this.pollingSubscription = interval(this.pollingInterval)
        .pipe(
            switchMap(() => this.cartService.checkPaymentResponse(uuid, payment_method)),
            map(response => ({
                ...response,
                status: response.status || false
            })),
            delay(9999999999999), // Wait before forcing status update
            map(response => ({
                ...response,
                status: true // Force status to true after 60s if still false
            })),
            takeWhile((response: { status: boolean }) => !response.status, true)
        )
        .subscribe({
            next: (response) => {
                console.log('Payment Status:', response);

                if (response.status) {
                    this.pollingSubscription.unsubscribe(); // Stop polling

                    // ✅ Close the popup window if still open
                    if (paymentWindow && !paymentWindow.closed) {
                        paymentWindow.close();
                        console.log("Payment popup closed automatically.");
                    }

                    this.handlePaymentSuccess(response, action, uuid, 'sub_paisa');
                }
            },
            error: (err) => {
                console.error('Error checking payment status:', err);
            },
            complete: () => {
                if (windowClosedManually) {
                    console.log("Polling stopped: Payment window was closed manually.");
                }
            }
        });
  }

  handlePaymentSuccess(response: any, action: any, uuid: any, payment_method: string) {
    console.log('Payment was successful:', response);
    console.log('Call /order here now', action);
    this.store.dispatch(new PlaceOrder(Object.assign({}, action, { uuid: uuid, payment_method })));
  }

  async checkPaymentResponse(uuid: any, payment_method: string) {
    this.cartService.checkPaymentResponse(uuid, payment_method).subscribe({
      next:(data) => {
        console.log(data);
        if(data.R === true || data.R === false) {
          console.log('Redirect to Success or Fail');
          this.router.navigate([ 'order/checkout-success' ], { queryParams: { order_status: data.R } });
        } else {
          console.log('Payment in Pending State');
        }
      },
      error:(err) => {
        console.log(err);
      }
    });
  }

  async redirectToPayURL() {
    this.cartService.redirectToPayUrl().subscribe({
      next:(data) => {
        console.log(data);
        if (data && data.url) {
          window.open(data.url, '_blank');
        }
      },
      error:(err) => {
        console.log(err);
      }
    });
  }

  // NeoKred

  initiateNeoKredPaymentIntent(payment_method: string, uuid: any, order_result: any) {
    const userData = localStorage.getItem('account');
    const parsedUserData = JSON.parse(userData || '{}')?.user || {};

    const payload = {
      uuid,
      ...parsedUserData,
      checkout: this.storeData?.order?.checkout
    };

    this.cartService.initiateNeoKredIntent({
      uuid: payload.uuid,
      email: payload.email,
      total: this.storeData?.order?.checkout?.total?.total,
      phone: parsedUserData.phone,
      name: parsedUserData.name,
      address: `${parsedUserData.address?.[0]?.city || ''} ${parsedUserData.address?.[0]?.area || ''}`
    }).subscribe({
      next: (response) => {
        if (response?.R && response?.data) {
          try {
            const neoKredData = response.data;
            
            if (neoKredData?.payment_url) {
              // Store payment info in session storage
              sessionStorage.setItem('payment_uuid', uuid);
              sessionStorage.setItem('payment_method', payment_method);
              sessionStorage.setItem('payment_action', JSON.stringify(this.form.value));
              localStorage.setItem('order_id', JSON.stringify(order_result.order_number));
              
              // Use window.location.href for Safari compatibility
              window.location.href = neoKredData.payment_url;
            } else {
              console.error("Invalid response: Payment link is missing.");
            }
          } catch (error) {
            console.error("Error parsing NeoKred response:", error);
          }
        } else {
          console.error("Payment initiation failed:", response?.msg);
        }
      },
      error: (err) => {
        console.log("Error initiating payment:", err);
      }
    });
  }

  checkTransectionStatusNeoKred() { // https://apidocument-cb.netlify.app/#transaction-status
    this.payByNeoStep = 1;
    this.loading = true;
    this.pollingSubscription = interval(this.pollingInterval)
        .pipe(
            switchMap(() => this.cartService.checkTransectionStatusNeoKred(
              { 
                uuid: 'payload.uuid', 
                email: 'payload.email',
                transactionId: "NKFV2ie9NpNUGTa5cETbpBDNoKM"
              })
            ),
            map((response: any) => ({
                ...response,
                status: response.status || false
            })),
            delay(9999999999999), // Wait before forcing status update
            map(response => ({
                ...response,
                status: true // Force status to true after 60s if still false
            })),
            takeWhile((response: { status: boolean }) => !response.status, true)
        )
        .subscribe({
            next: (response) => {
                console.log('Payment Status:', response);

                if (response.status) {
                    this.loading = false;
                    this.pollingSubscription.unsubscribe(); // Stop polling

                    // this.handlePaymentSuccess(response, action, uuid);
                }
            },
            error: (err) => {
                console.error('Error checking payment status:', err);
            },
            complete: () => {
              //
            }
        });
  }

  // CashFree Payment Integration
  initiateCashFreePaymentIntent(payment_method: string, uuid: any, order_result: any) {
    const userData = localStorage.getItem('account');
    const parsedUserData = JSON.parse(userData || '{}')?.user || {};

    const payload = {
      uuid,
      ...parsedUserData,
      checkout: this.storeData?.order?.checkout
    };

    this.cartService.initiateCashFreeIntent({
      uuid: payload.uuid,
      email: payload.email,
      total: this.storeData?.order?.checkout?.total?.total,
      phone: parsedUserData.phone,
      name: parsedUserData.name,
      address: `${parsedUserData.address?.[0]?.city || ''} ${parsedUserData.address?.[0]?.area || ''}`
    }).subscribe({
      next: (response) => {
        if (response?.R && response?.data) {
          try {
            const cashFreeData = response.data;
            
            if (cashFreeData?.payment_link) {
              // Store payment info in session storage
              sessionStorage.setItem('payment_uuid', uuid);
              sessionStorage.setItem('payment_method', payment_method);
              sessionStorage.setItem('payment_action', JSON.stringify(this.form.value));
              localStorage.setItem('order_id', JSON.stringify(order_result.order_number));
              
              // Use window.location.href for Safari compatibility
              window.location.href = cashFreeData.payment_link;
            } else {
              console.error("Invalid response: Payment link is missing.");
            }
          } catch (error) {
            console.error("Error parsing CashFree response:", error);
          }
        } else {
          console.error("Payment initiation failed:", response?.msg);
        }
      },
      error: (err) => {
        console.log("Error initiating payment:", err);
      }
    });
  }

  checkTransactionStatusCashFree(uuid: any,payment_method: string) {
    this.cartService.checkTransectionStatusCashFree(uuid, payment_method).subscribe({
      next:(data) => {
        console.log(data);
        if(data.R === true || data.R === false) {
          console.log('Redirect to Success or Fail');
          this.router.navigate([ 'order/checkout-success' ], { queryParams: { order_status: data.R } });
        } else {
          console.log('Payment in Pending State');
        }
      },
      error:(err) => {
        console.log(err);
      }
    });
  }

  // Fashion with Trends NeoKred Payment Integration
  initiateFashionWithTrendsNeoCredIntent(payment_method: string, uuid: any, order_result: any) {
    const userData = localStorage.getItem('account');
    const parsedUserData = JSON.parse(userData || '{}')?.user || {};

    const payload = {
      uuid,
      ...parsedUserData,
      checkout: this.storeData?.order?.checkout
    };

    this.cartService.initiateFashionWithTrendsNeoCredIntent({
      uuid: payload.uuid,
      email: payload.email,
      total: this.storeData?.order?.checkout?.total?.total,
      phone: parsedUserData.phone,
      name: parsedUserData.name,
      address: `${parsedUserData.address?.[0]?.city || ''} ${parsedUserData.address?.[0]?.area || ''}`
    }).subscribe({
      next: (response) => {
        if (response?.R && response?.data) {
          try {
            const zyaadaPayData = response.data;
            
            if (zyaadaPayData?.payment_url) {
              // Store payment info in session storage
              sessionStorage.setItem('payment_uuid', uuid);
              sessionStorage.setItem('payment_method', payment_method);
              sessionStorage.setItem('payment_action', JSON.stringify(this.form.value));
              localStorage.setItem('order_id', JSON.stringify(order_result.order_number));
              // Open in current tab
              window.location.href = zyaadaPayData.payment_url;
            } else {
              console.error("Invalid response: Payment link is missing.");
              this.notificationService.showError(zyaadaPayData.message);
            }
          } catch (error) {
              console.error("Error parsing Zyaada Pay response:", error);
          }
        } else {
          console.error("Payment initiation failed:", response?.msg);
        }
      },
      error: (err) => {
        console.log("Error initiating payment:", err);
      }
    });
  }

  async openNeoKredModal(data: any) {
    this.payByNeoKredIntentSaveData = data;
    console.log(this.payByNeoKredIntentSaveData);
    this.modalService.open(this.payByQRModal, {
      ariaLabelledBy: 'address-add-Modal',
      centered: true,
      windowClass: 'theme-modal modal-lg address-modal'
    }).result.then((result) => {
      `Result ${result}`
      const formDataContainer = document.getElementById('formDataContainer');
      console.log(formDataContainer);
    }, (reason) => {
      const formDataContainer = document.getElementById('formDataContainer');
      console.log(formDataContainer);
    });
  }

  payByNeoKredIntentSaveDataUpiIntentString(upi:string) {
    switch (upi) {
      case 'gpay_upi':
        return this.payByNeoKredIntentSaveData.upiIntentString.replace("upi://pay?", "tez://pay?");
      case 'phone_pay_upi':
        return this.payByNeoKredIntentSaveData.upiIntentString.replace("upi://pay?", "phonepe://pay?");
      case 'paytm_upi':
        return this.payByNeoKredIntentSaveData.upiIntentString.replace("upi://pay?", "paytmmp://pay?");
      case 'bhim_upi':
        break;
        // return this.payByNeoKredIntentSaveData.upiIntentString.replace()
      default:
        break;
    }

  }

  paybyNeoNext() {
    this.payByNeoStep = 1;
  }

  paybyNeoDone() {
    this.payByNeoStep = 0;
    this.modalService.dismissAll();
    this.pollingSubscription.unsubscribe();
  }


  togglePoint(event: Event) {
    this.form.controls['points_amount'].setValue((<HTMLInputElement>event.target)?.checked);
    this.checkout();
  }

  toggleWallet(event: Event) {
    this.form.controls['wallet_balance'].setValue((<HTMLInputElement>event.target)?.checked);
    this.checkout();
  }

  showCoupon() {
    this.coupon = true;
  }

  setCoupon(value?: string) {
    this.couponError = null;

    if(value)
      this.form.controls['coupon'].setValue(value);
    else
      this.form.controls['coupon'].reset();

    this.store.dispatch(new Checkout(this.form.value)).subscribe({
      error: (err) => {
        this.couponError = err.message;
      },
      complete: () => {
        this.appliedCoupon = value ? true : false;
        this.couponError = null;
      }
    });
  }

  couponRemove() {
    this.setCoupon();
  }

  shippingCountryChange(data: Select2UpdateEvent) {
    if(data && data?.value) {
      this.shippingStates$ = this.store
          .select(StateState.states)
          .pipe(map(filterFn => filterFn(+data?.value)));
    } else {
      this.form.get('shipping_address.state_id')?.setValue('');
      this.shippingStates$ = of();
    }
  }

  billingCountryChange(data: Select2UpdateEvent) {
    if(data && data?.value) {
      this.billingStates$ = this.store
          .select(StateState.states)
          .pipe(map(filterFn => filterFn(+data?.value)));
      if(this.form.get('billing_address.same_shipping')?.value) {
        setTimeout(() => {
          this.form.get('billing_address.state_id')?.setValue(this.form.get('shipping_address.state_id')?.value);
        }, 200);
      }
    } else {
      this.form.get('billing_address.state_id')?.setValue('');
      this.billingStates$ = of();
    }
  }

  checkout(payment_method?:string) {
    // If has coupon error while checkout
    if(this.couponError){
      this.couponError = null;
      this.cpnRef.nativeElement.value = '';
      this.form.controls['coupon'].reset();
    }

    if(this.form.valid) {
      this.loading = true;
      this.store.dispatch(new Checkout(this.form.value)).subscribe({
        next:(value) => {
          this.storeData = value;
          console.log(this.storeData);
        },
        error: (err) => {
          this.loading = false;
          throw new Error(err);
        },
        complete: () => {
          this.loading = false;
        }
      });
    } else {
      const invalidFields = Object?.keys(this.form?.controls).filter(key => this.form.controls[key].invalid);
    }
  }

  placeorder() {
    if(this.form.valid) {
      if(this.cpnRef && !this.cpnRef.nativeElement.value) {
        this.form.controls['coupon'].reset();
      }

      const uuid = uuidv4();

      const formData = {
        ...this.form.value,
        uuid: uuid
      }

      let action = new PlaceOrder(formData);

      this.orderService.placeOrder(action?.payload).pipe(
        tap({
          next: result => {
            console.log(result);
          },
          error: err => {
            throw new Error(err?.error?.message);
          }
        })
      ).subscribe({
        next: (result) => {
          if(this.payment_method === 'cash_free'){
            this.initiateCashFreePaymentIntent(this.payment_method, uuid, result);
          }
          if(this.payment_method === 'sub_paisa'){
            this.initiateSubPaisa(this.payment_method, uuid, result);
          }
          if(this.payment_method === 'neoKred') {
            this.initiateNeoKredPaymentIntent(this.payment_method, uuid, result);
          }
          if(this.payment_method === 'zyaada_pay') {
            this.initiateZyaadaPayPaymentIntent(this.payment_method, uuid, result);
          }
          if(this.payment_method === 'ease_buzz') {
            this.initiateEaseBuzzPaymentIntent(this.payment_method, uuid, result);
          }
          if(this.payment_method === 'neoKred2') {
            this.initiateNeoKred2PaymentIntent(this.payment_method, uuid, result);
          }
          if(this.payment_method === 'gaonvashi_cashfree') {
            this.initiateGaonvashiCashFreePaymentIntent(this.payment_method, uuid, result);
          }
        },
        error: (err) => {
          console.log(err);
          this.loading = false;
        }
      });
    } else {
      // Mark all fields as touched to show validation errors
      Object.keys(this.form.controls).forEach(key => {
        const control = this.form.get(key);
        control?.markAsTouched();
      });
    }
  }

  paybyqr() {
    this.modalService.dismissAll();
    // PlaceOrder Here
  }

  clearCart(){
    this.store.dispatch(new ClearCart());
  }

  ngOnDestroy() {
    this.loading = false;
    this.store.dispatch(new ClearCart());
    this.form.reset();
    this.pollingSubscription && this.pollingSubscription.unsubscribe();
  }

  // Zyaada Pay Payment Integration
  initiateZyaadaPayPaymentIntent(payment_method: string, uuid: any, order_result: any) {
    const userData = localStorage.getItem('account');
    const parsedUserData = JSON.parse(userData || '{}')?.user || {};

    const payload = {
      uuid,
      ...parsedUserData,
      checkout: this.storeData?.order?.checkout
    };

    this.cartService.initiateZyaadaPayIntent({
      uuid: payload.uuid,
      email: payload.email,
      total: this.storeData?.order?.checkout?.total?.total,
      phone: parsedUserData.phone,
      name: parsedUserData.name,
      address: `${parsedUserData.address?.[0]?.city || ''} ${parsedUserData.address?.[0]?.area || ''}`
    }).subscribe({
      next: (response) => {
        if (response?.R && response?.data) {
          try {
            const zyaadaPayData = response.data;
            
            if (zyaadaPayData?.payment_url) {
              // Store payment info in session storage
              sessionStorage.setItem('payment_uuid', uuid);
              sessionStorage.setItem('payment_method', payment_method);
              sessionStorage.setItem('payment_action', JSON.stringify(this.form.value));
              localStorage.setItem('order_id', JSON.stringify(order_result.order_number));
              
              // Use window.location.href for Safari compatibility
              window.location.href = zyaadaPayData.payment_url;
            } else {
              console.error("Invalid response: Payment link is missing.");
            }
          } catch (error) {
            console.error("Error parsing Zyaada Pay response:", error);
          }
        } else {
          console.error("Payment initiation failed:", response?.msg);
        }
      },
      error: (err) => {
        console.log("Error initiating payment:", err);
      }
    });
  }

  // Gaonvashi CashFree Payment Integration
  initiateGaonvashiCashFreePaymentIntent(payment_method: string, uuid: any, order_result: any) {
    const userData = localStorage.getItem('account');
    const parsedUserData = JSON.parse(userData || '{}')?.user || {};

    const payload = {
      uuid,
      ...parsedUserData,
      checkout: this.storeData?.order?.checkout
    };

    this.cartService.initiateGaonvashiCashFreePaymentIntent({
      uuid: payload.uuid,
      email: payload.email,
      total: this.storeData?.order?.checkout?.total?.total,
      phone: parsedUserData.phone,
      name: parsedUserData.name,
      address: `${parsedUserData.address?.[0]?.city || ''} ${parsedUserData.address?.[0]?.area || ''}`
    }).subscribe({
      next: (response) => {
        if (response?.R && response?.data) {
          try {
            const cashFreeData = response.data;
            
            if (cashFreeData?.payment_url) {
              // Store payment info in session storage
              sessionStorage.setItem('payment_uuid', uuid);
              sessionStorage.setItem('payment_method', payment_method);
              sessionStorage.setItem('payment_action', JSON.stringify(this.form.value));
              localStorage.setItem('order_id', JSON.stringify(order_result.order_number));
              
              // Use window.location.href for Safari compatibility
              window.location.href = cashFreeData.payment_url;
            } else {
              console.error("Invalid response: Payment link is missing.");
            }
          } catch (error) {
            console.error("Error parsing Gaonvashi CashFree response:", error);
          }
        } else {
          console.error("Payment initiation failed:", response?.msg);
        }
      },
      error: (err) => {
        console.log("Error initiating payment:", err);
      }
    });
  }

  // EaseBuzz Payment Integration
  initiateEaseBuzzPaymentIntent(payment_method: string, uuid: any, order_result: any) {
    const userData = localStorage.getItem('account');
    const parsedUserData = JSON.parse(userData || '{}')?.user || {};

    const payload = {
      uuid,
      ...parsedUserData,
      checkout: this.storeData?.order?.checkout
    };

    // Use initiateCashFreeIntent as a fallback since EaseBuzz is not implemented
    this.cartService.initiateCashFreeIntent({
      uuid: payload.uuid,
      email: payload.email,
      total: this.storeData?.order?.checkout?.total?.total,
      phone: parsedUserData.phone,
      name: parsedUserData.name,
      address: `${parsedUserData.address?.[0]?.city || ''} ${parsedUserData.address?.[0]?.area || ''}`
    }).subscribe({
      next: (response: PaymentResponse) => {
        if (response?.R && response?.data) {
          try {
            const easeBuzzData = response.data;
            
            if (easeBuzzData?.payment_url) {
              // Store payment info in session storage
              sessionStorage.setItem('payment_uuid', uuid);
              sessionStorage.setItem('payment_method', payment_method);
              sessionStorage.setItem('payment_action', JSON.stringify(this.form.value));
              localStorage.setItem('order_id', JSON.stringify(order_result.order_number));
              
              // Use window.location.href for Safari compatibility
              window.location.href = easeBuzzData.payment_url;
            } else {
              console.error("Invalid response: Payment link is missing.");
            }
          } catch (error) {
            console.error("Error parsing EaseBuzz response:", error);
          }
        } else {
          console.error("Payment initiation failed:", response?.msg);
        }
      },
      error: (err: PaymentError) => {
        console.log("Error initiating payment:", err?.error?.message || err?.message);
      }
    });
  }

  // NeoKred2 Payment Integration
  initiateNeoKred2PaymentIntent(payment_method: string, uuid: any, order_result: any) {
    const userData = localStorage.getItem('account');
    const parsedUserData = JSON.parse(userData || '{}')?.user || {};

    const payload = {
      uuid,
      ...parsedUserData,
      checkout: this.storeData?.order?.checkout
    };

    // Use initiateNeoKredIntent since NeoKred2 is not implemented
    this.cartService.initiateNeoKredIntent({
      uuid: payload.uuid,
      email: payload.email,
      total: this.storeData?.order?.checkout?.total?.total,
      phone: parsedUserData.phone,
      name: parsedUserData.name,
      address: `${parsedUserData.address?.[0]?.city || ''} ${parsedUserData.address?.[0]?.area || ''}`
    }).subscribe({
      next: (response: PaymentResponse) => {
        if (response?.R && response?.data) {
          try {
            const neoKredData = response.data;
            
            if (neoKredData?.payment_url) {
              // Store payment info in session storage
              sessionStorage.setItem('payment_uuid', uuid);
              sessionStorage.setItem('payment_method', payment_method);
              sessionStorage.setItem('payment_action', JSON.stringify(this.form.value));
              localStorage.setItem('order_id', JSON.stringify(order_result.order_number));
              
              // Use window.location.href for Safari compatibility
              window.location.href = neoKredData.payment_url;
            } else {
              console.error("Invalid response: Payment link is missing.");
            }
          } catch (error) {
            console.error("Error parsing NeoKred2 response:", error);
          }
        } else {
          console.error("Payment initiation failed:", response?.msg);
        }
      },
      error: (err: PaymentError) => {
        console.log("Error initiating payment:", err?.error?.message || err?.message);
      }
    });
  }

}
